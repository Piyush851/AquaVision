import torch
import torch.nn as nn
import torch.nn.functional as F


class SEBlock(nn.Module):
    """Squeeze-and-Excitation channel attention block."""
    def __init__(self, channels: int, reduction: int = 16):
        super().__init__()
        reduced = max(channels // reduction, 8)
        self.fc = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Conv2d(channels, reduced, kernel_size=1, bias=False),
            nn.ReLU(inplace=True),
            nn.Conv2d(reduced, channels, kernel_size=1, bias=False),
            nn.Sigmoid()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * self.fc(x)


class ResidualBlock(nn.Module):
    """Residual block with InstanceNorm and SE channel attention."""
    def __init__(self, channels: int):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False),
            nn.InstanceNorm2d(channels),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False),
            nn.InstanceNorm2d(channels)
        )
        self.se = SEBlock(channels)
        self.relu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        res = self.conv(x)
        res = self.se(res)
        return self.relu(x + res)


class DownBlock(nn.Module):
    """Downsampling stage with convolution and residual attention block."""
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.down = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, stride=2, padding=1, bias=False),
            nn.InstanceNorm2d(out_channels),
            nn.LeakyReLU(0.2, inplace=True)
        )
        self.res = ResidualBlock(out_channels)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.res(self.down(x))


class UpBlock(nn.Module):
    """Upsampling stage with transposed convolution and skip connection fusion."""
    def __init__(self, in_channels: int, skip_channels: int, out_channels: int):
        super().__init__()
        self.up = nn.ConvTranspose2d(
            in_channels, out_channels, kernel_size=4, stride=2, padding=1, bias=False
        )
        self.norm = nn.InstanceNorm2d(out_channels)
        self.relu = nn.LeakyReLU(0.2, inplace=True)
        self.conv = nn.Sequential(
            nn.Conv2d(out_channels + skip_channels, out_channels, kernel_size=3, padding=1, bias=False),
            nn.InstanceNorm2d(out_channels),
            nn.LeakyReLU(0.2, inplace=True),
            ResidualBlock(out_channels)
        )

    def forward(self, x: torch.Tensor, skip: torch.Tensor) -> torch.Tensor:
        x = self.relu(self.norm(self.up(x)))
        if x.shape[2:] != skip.shape[2:]:
            x = F.interpolate(x, size=skip.shape[2:], mode="bilinear", align_corners=False)
        merged = torch.cat([x, skip], dim=1)
        return self.conv(merged)


class AquaVisionNet(nn.Module):
    """
    Residual U-Net with SE Attention for Underwater Image Enhancement.
    """
    def __init__(self, in_channels: int = 3, out_channels: int = 3, base_channels: int = 32):
        super().__init__()
        
        # Initial feature extraction (Level 0)
        self.init_conv = nn.Sequential(
            nn.Conv2d(in_channels, base_channels, kernel_size=3, padding=1, bias=False),
            nn.InstanceNorm2d(base_channels),
            nn.LeakyReLU(0.2, inplace=True),
            ResidualBlock(base_channels)
        )
        
        # 4 Downsampling stages
        self.down1 = DownBlock(base_channels, base_channels * 2)       # 32 -> 64
        self.down2 = DownBlock(base_channels * 2, base_channels * 4)   # 64 -> 128
        self.down3 = DownBlock(base_channels * 4, base_channels * 8)   # 128 -> 256
        self.down4 = DownBlock(base_channels * 8, base_channels * 16)  # 256 -> 512
        
        # Bottleneck
        self.bottleneck = nn.Sequential(
            ResidualBlock(base_channels * 16),
            ResidualBlock(base_channels * 16)
        )
        
        # 4 Upsampling stages with skip connections
        self.up4 = UpBlock(base_channels * 16, base_channels * 8, base_channels * 8)  # 512 + 256 -> 256
        self.up3 = UpBlock(base_channels * 8, base_channels * 4, base_channels * 4)   # 256 + 128 -> 128
        self.up2 = UpBlock(base_channels * 4, base_channels * 2, base_channels * 2)   # 128 + 64 -> 64
        self.up1 = UpBlock(base_channels * 2, base_channels, base_channels)           # 64 + 32 -> 32
        
        # Output reconstruction layer bounded to [0, 1]
        self.out_conv = nn.Sequential(
            nn.Conv2d(base_channels, out_channels, kernel_size=3, padding=1),
            nn.Sigmoid()
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Encoder forward pass
        s0 = self.init_conv(x)
        s1 = self.down1(s0)
        s2 = self.down2(s1)
        s3 = self.down3(s2)
        s4 = self.down4(s3)
        
        # Bottleneck
        b = self.bottleneck(s4)
        
        # Decoder forward pass with skip connections
        d4 = self.up4(b, s3)
        d3 = self.up3(d4, s2)
        d2 = self.up2(d3, s1)
        d1 = self.up1(d2, s0)
        
        # Sigmoid output in [0, 1]
        return self.out_conv(d1)
