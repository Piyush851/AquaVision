import torch
import torch.nn as nn
import torch.nn.functional as F


class ChannelAttention(nn.Module):
    """
    Channel Attention Module to dynamically re-weight RGB feature channels 
    to compensate for selective underwater light attenuation (red light absorption).
    """
    def __init__(self, in_channels: int, reduction: int = 16):
        super(ChannelAttention, self).__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        
        reduced_channels = max(in_channels // reduction, 8)
        self.fc = nn.Sequential(
            nn.Conv2d(in_channels, reduced_channels, 1, bias=False),
            nn.ReLU(inplace=True),
            nn.Conv2d(reduced_channels, in_channels, 1, bias=False)
        )
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg_out = self.fc(self.avg_pool(x))
        max_out = self.fc(self.max_pool(x))
        out = avg_out + max_out
        return x * self.sigmoid(out)


class ResidualBlock(nn.Module):
    """
    Residual Block with Conv-InstanceNorm-LeakyReLU layers for feature preservation.
    """
    def __init__(self, channels: int):
        super(ResidualBlock, self).__init__()
        self.block = nn.Sequential(
            nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False),
            nn.InstanceNorm2d(channels),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False),
            nn.InstanceNorm2d(channels)
        )
        self.attention = ChannelAttention(channels)

    def forward(self, x):
        res = self.block(x)
        res = self.attention(res)
        return x + res


class AquaVisionNet(nn.Module):
    """
    AquaVision Deep Learning Neural Network for Underwater Image Enhancement (UWIE).
    Uses residual U-Net architecture with multi-scale skip connections and color channel attention.
    """
    def __init__(self, in_channels: int = 3, out_channels: int = 3, base_features: int = 64):
        super(AquaVisionNet, self).__init__()

        # Initial Feature Extractor
        self.enc_conv1 = nn.Sequential(
            nn.Conv2d(in_channels, base_features, kernel_size=7, padding=3, bias=False),
            nn.InstanceNorm2d(base_features),
            nn.LeakyReLU(0.2, inplace=True)
        )

        # Downsampling Encoder
        self.enc_conv2 = nn.Sequential(
            nn.Conv2d(base_features, base_features * 2, kernel_size=3, stride=2, padding=1, bias=False),
            nn.InstanceNorm2d(base_features * 2),
            nn.LeakyReLU(0.2, inplace=True)
        )
        self.enc_conv3 = nn.Sequential(
            nn.Conv2d(base_features * 2, base_features * 4, kernel_size=3, stride=2, padding=1, bias=False),
            nn.InstanceNorm2d(base_features * 4),
            nn.LeakyReLU(0.2, inplace=True)
        )

        # Residual Bottleneck with Channel Attention
        self.res_blocks = nn.Sequential(
            ResidualBlock(base_features * 4),
            ResidualBlock(base_features * 4),
            ResidualBlock(base_features * 4),
            ResidualBlock(base_features * 4)
        )

        # Upsampling Decoder
        self.dec_conv1 = nn.Sequential(
            nn.ConvTranspose2d(base_features * 4, base_features * 2, kernel_size=3, stride=2, padding=1, output_padding=1, bias=False),
            nn.InstanceNorm2d(base_features * 2),
            nn.ReLU(inplace=True)
        )
        self.dec_conv2 = nn.Sequential(
            nn.ConvTranspose2d(base_features * 4, base_features, kernel_size=3, stride=2, padding=1, output_padding=1, bias=False),
            nn.InstanceNorm2d(base_features),
            nn.ReLU(inplace=True)
        )

        # Output Generation with Residual Shortcut Connection
        self.out_conv = nn.Sequential(
            nn.Conv2d(base_features * 2, out_channels, kernel_size=7, padding=3),
            nn.Tanh()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Scale input range [0, 1] -> [-1, 1] for Tanh processing
        x_norm = x * 2.0 - 1.0

        # Encoder forward pass
        e1 = self.enc_conv1(x_norm)
        e2 = self.enc_conv2(e1)
        e3 = self.enc_conv3(e2)

        # Bottleneck
        b = self.res_blocks(e3)

        # Decoder with Skip Connections
        d1 = self.dec_conv1(b)
        d1_cat = torch.cat([d1, e2], dim=1)

        d2 = self.dec_conv2(d1_cat)
        d2_cat = torch.cat([d2, e1], dim=1)

        # Output residual prediction
        residual = self.out_conv(d2_cat)
        out = torch.clamp(x_norm + residual, -1.0, 1.0)

        # Re-scale back to [0, 1] range
        return (out + 1.0) / 2.0
