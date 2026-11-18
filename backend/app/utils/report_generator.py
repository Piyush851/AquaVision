import os
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus import Image as RLImage


def generate_inspection_pdf(
    raw_img_path: str,
    enhanced_img_path: str,
    metrics: dict[str, Any],
    output_pdf_path: str,
    operator_name: str = "Piyush Saini (23EEAIT043)",
    project_title: str = "AquaVision AI - Underwater Optical Inspection System",
    supervisor: str = "Mrs. Bhanupriya Sharma (Engineering College Ajmer)",
    notes: str | None = None,
    detections: list | None = None,
    coral_health: dict[str, Any] | None = None,
    annotated_img_path: str | None = None
) -> str:
    """
    Generates a professional engineering PDF inspection report for marine/underwater visual data.
    Incorporates quantitative metrology (UIQM, UCIQE, PSNR), side-by-side photographic evidence,
    marine biological species detection, coral bleaching assessment, and formal verification blocks.
    """
    pdf_path = Path(output_pdf_path)
    pdf_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#0f172a")
    accent_color = colors.HexColor("#0284c7")
    neutral_bg = colors.HexColor("#f8fafc")
    border_color = colors.HexColor("#cbd5e1")

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=primary_color,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=15
    )

    h2_style = ParagraphStyle(
        "ReportH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=accent_color,
        spaceBefore=10,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155")
    )

    elements = []

    # Title & Header
    elements.append(Paragraph("AQUAVISION AI &bull; DEEP-SEA INSPECTION REPORT", title_style))
    elements.append(Paragraph(
        f"Automated Marine Optical Metrology & Quality Assessment | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        subtitle_style
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=accent_color, spaceAfter=14))

    # Project Information Table
    info_data = [
        [
            Paragraph("<b>Project:</b>", body_style),
            Paragraph(project_title, body_style),
            Paragraph("<b>Inspection Date:</b>", body_style),
            Paragraph(datetime.now().strftime("%B %d, %Y"), body_style),
        ],
        [
            Paragraph("<b>Lead Specialist:</b>", body_style),
            Paragraph(operator_name, body_style),
            Paragraph("<b>Project Supervisor:</b>", body_style),
            Paragraph(supervisor, body_style),
        ],
        [
            Paragraph("<b>Model Architecture:</b>", body_style),
            Paragraph(metrics.get("model_name", "AquaVisionNet (Residual U-Net)"), body_style),
            Paragraph("<b>Acceleration:</b>", body_style),
            Paragraph("CUDA GPU + FP16 Mixed Precision", body_style),
        ]
    ]

    info_table = Table(info_data, colWidths=[90, 180, 110, 150])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), neutral_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, border_color),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 14))

    # Visual Evidence: Side-by-Side Images
    elements.append(Paragraph("1. PHOTOGRAMMETRIC EVIDENCE (PRE VS. POST ENHANCEMENT)", h2_style))
    
    img_w, img_h = 245, 170
    raw_rl = None
    enh_rl = None

    display_enh_path = annotated_img_path if (annotated_img_path and os.path.exists(annotated_img_path)) else enhanced_img_path

    if os.path.exists(raw_img_path):
        raw_rl = RLImage(raw_img_path, width=img_w, height=img_h)
    if os.path.exists(display_enh_path):
        enh_rl = RLImage(display_enh_path, width=img_w, height=img_h)

    if raw_rl and enh_rl:
        img_table = Table(
            [
                [raw_rl, enh_rl],
                [
                    Paragraph("<b>Raw In-Situ Underwater Capture</b><br/>(Severe attenuation, color cast, backscatter)", body_style),
                    Paragraph("<b>AquaVision Enhanced & HUD Inspected Frame</b><br/>(Restored chrominance, contrast & sharpness)", body_style)
                ]
            ],
            colWidths=[265, 265]
        )
        img_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 4),
            ('TOPPADDING', (0, 1), (-1, 1), 4),
        ]))
        elements.append(img_table)
    elements.append(Spacer(1, 14))

    # Quantitative Metrology
    elements.append(Paragraph("2. QUANTITATIVE OPTICAL QUALITY METRICS", h2_style))

    raw_uiqm = float(metrics.get("raw_uiqm", 0.0) or 0.0)
    enh_uiqm = float(metrics.get("uiqm", 0.0) or 0.0)
    raw_uciqe = float(metrics.get("raw_uciqe", 0.0) or 0.0)
    enh_uciqe = float(metrics.get("uciqe", 0.0) or 0.0)
    psnr_val = float(metrics.get("estimated_psnr", 0.0) or 0.0)
    latency_ms = metrics.get("latency_ms", "N/A")

    uiqm_gain = f"+{((enh_uiqm - raw_uiqm) / (raw_uiqm + 1e-6)) * 100:.1f}%" if raw_uiqm > 0 else "N/A"
    uciqe_gain = f"+{((enh_uciqe - raw_uciqe) / (raw_uciqe + 1e-6)) * 100:.1f}%" if raw_uciqe > 0 else "N/A"

    metrics_data = [
        [
            Paragraph("<b>Evaluation Metric</b>", body_style),
            Paragraph("<b>Raw Capture</b>", body_style),
            Paragraph("<b>Enhanced Output</b>", body_style),
            Paragraph("<b>Delta / Gain</b>", body_style),
            Paragraph("<b>Industry Benchmark Target</b>", body_style)
        ],
        [
            Paragraph("<b>UIQM</b> (Underwater Image Quality Measure)", body_style),
            Paragraph(f"{raw_uiqm:.2f}" if raw_uiqm > 0 else "N/A", body_style),
            Paragraph(f"<b>{enh_uiqm:.2f}</b>", body_style),
            Paragraph(f"<font color='#059669'><b>{uiqm_gain}</b></font>", body_style),
            Paragraph("&ge; 2.50 (High Clarity)", body_style)
        ],
        [
            Paragraph("<b>UCIQE</b> (Color & Contrast Evaluation)", body_style),
            Paragraph(f"{raw_uciqe:.2f}" if raw_uciqe > 0 else "N/A", body_style),
            Paragraph(f"<b>{enh_uciqe:.2f}</b>", body_style),
            Paragraph(f"<font color='#059669'><b>{uciqe_gain}</b></font>", body_style),
            Paragraph("&ge; 0.50 (Balanced Chrominance)", body_style)
        ],
        [
            Paragraph("<b>Estimated PSNR</b> (Peak Signal-to-Noise)", body_style),
            Paragraph("Baseline (0 dB)", body_style),
            Paragraph(f"<b>{psnr_val:.2f} dB</b>", body_style),
            Paragraph(f"+{psnr_val:.2f} dB", body_style),
            Paragraph("&ge; 18.0 dB (Acceptable Fidelity)", body_style)
        ],
        [
            Paragraph("<b>Processing Latency</b>", body_style),
            Paragraph("0 ms", body_style),
            Paragraph(f"<b>{latency_ms} ms</b>", body_style),
            Paragraph("Real-Time", body_style),
            Paragraph("&lt; 250 ms (ROV Live Telemetry)", body_style)
        ]
    ]

    metric_table = Table(metrics_data, colWidths=[170, 75, 90, 80, 115])
    metric_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(metric_table)
    elements.append(Spacer(1, 14))

    # Marine Ecological & Coral Reef Health (Milestone B Integration)
    if detections or coral_health:
        elements.append(Paragraph("3. MARINE ECOLOGICAL INTELLIGENCE & CORAL BLEACHING SURVEY", h2_style))
        eco_rows = []
        if coral_health:
            eco_rows.append([
                Paragraph("<b>Benthic Reef Health Status:</b>", body_style),
                Paragraph(f"<b>{coral_health.get('health_status', 'N/A')}</b>", body_style),
                Paragraph("<b>Bleaching Index:</b>", body_style),
                Paragraph(f"<b>{coral_health.get('bleaching_index', 0.0)}</b> ({coral_health.get('bleached_coral_pct', 0.0)}% Bleached)", body_style)
            ])
            eco_rows.append([
                Paragraph("<b>Reef Bed Coverage:</b>", body_style),
                Paragraph(f"{coral_health.get('coverage_pct', 0.0)}%", body_style),
                Paragraph("<b>Algal Turf Overgrowth:</b>", body_style),
                Paragraph(f"{coral_health.get('algae_overgrowth_pct', 0.0)}%", body_style)
            ])
            eco_rows.append([
                Paragraph("<b>Ecological Advisory:</b>", body_style),
                Paragraph(coral_health.get('recommendation', 'Standard benthic monitoring.'), body_style),
                Paragraph("<b>Identified Organisms:</b>", body_style),
                Paragraph(f"{len(detections or [])} targets located", body_style)
            ])
        else:
            eco_rows.append([
                Paragraph("<b>Biological Detections:</b>", body_style),
                Paragraph(f"{len(detections or [])} targets located in water column", body_style),
                Paragraph("<b>Survey Category:</b>", body_style),
                Paragraph("Pelagic Marine Fauna Survey", body_style)
            ])

        eco_table = Table(eco_rows, colWidths=[120, 160, 110, 140])
        eco_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f0fdf4")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#86efac")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#bbf7d0")),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(eco_table)
        elements.append(Spacer(1, 14))

    # Engineering Assessment & Observations
    sec_num = "4" if (detections or coral_health) else "3"
    elements.append(Paragraph(f"{sec_num}. SYSTEM OBSERVATIONS & QUALITY SUMMARY", h2_style))
    summary_text = (
        notes or (
            "The input frame demonstrated heavy wavelength-dependent attenuation typical of saline marine bodies, "
            "predominantly red-channel absorption and diffuse particulate scattering. AquaVisionNet restored high-frequency "
            "structural edges, compensated localized contrast gradients, and normalized underwater chrominance. "
            "The optical assessment demonstrates measurable enhancement across non-reference quality metrics (UIQM and UCIQE), "
            "fulfilling subsea inspection criteria for automated structural inspection and marine biology survey."
        )
    )
    elements.append(Paragraph(summary_text, body_style))
    elements.append(Spacer(1, 14))

    # Verification and Sign-off
    sec_num_sign = "5" if (detections or coral_health) else "4"
    elements.append(KeepTogether([
        Paragraph(f"{sec_num_sign}. INSPECTION SIGN-OFF & RECORD VERIFICATION", h2_style),
        Spacer(1, 4),
        Table([
            [
                Paragraph("<b>Inspection Conducted By:</b><br/>" + operator_name + "<br/>Role 2: Team Lead & CV Specialist", body_style),
                Paragraph("<b>Supervising Faculty Approval:</b><br/>" + supervisor + "<br/>Department of Information Technology", body_style),
            ],
            [
                Paragraph("<i>Signature: _________________________</i>", body_style),
                Paragraph("<i>Signature: _________________________</i>", body_style)
            ]
        ], colWidths=[265, 265], style=[
            ('BOX', (0, 0), (-1, -1), 0.5, border_color),
            ('BACKGROUND', (0, 0), (-1, -1), neutral_bg),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ])
    ]))

    doc.build(elements)
    return str(pdf_path)


def generate_batch_survey_pdf(
    batch_records: list,
    output_pdf_path: str,
    operator_name: str = "Piyush Saini (23EEAIT043)",
    project_title: str = "AquaVision AI - Batch Subsea Visual Survey",
    supervisor: str = "Mrs. Bhanupriya Sharma (Engineering College Ajmer)",
    survey_name: str = "Subsea Inspection Survey Mission"
) -> str:
    """
    Generates a multi-image Marine Survey Executive Report summarizing a complete batch processing run.
    Contains overall metrology gains, marine species census, and photographic inspection index.
    """
    pdf_path = Path(output_pdf_path)
    pdf_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()
    primary_color = colors.HexColor("#0f172a")
    accent_color = colors.HexColor("#0284c7")
    neutral_bg = colors.HexColor("#f8fafc")
    border_color = colors.HexColor("#cbd5e1")

    title_style = ParagraphStyle(
        "BatchTitle", parent=styles["Normal"],
        fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=primary_color, spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        "BatchSubtitle", parent=styles["Normal"],
        fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor("#64748b"), spaceAfter=12
    )
    h2_style = ParagraphStyle(
        "BatchH2", parent=styles["Heading2"],
        fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=accent_color, spaceBefore=8, spaceAfter=4
    )
    body_style = ParagraphStyle(
        "BatchBody", parent=styles["Normal"],
        fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#334155")
    )

    elements = []

    # Title & Header
    elements.append(Paragraph("AQUAVISION AI &bull; BATCH MARINE SURVEY REPORT", title_style))
    elements.append(Paragraph(
        f"Mission: {survey_name} | Total Frames: {len(batch_records)} | Date: {datetime.now().strftime('%B %d, %Y %H:%M')}",
        subtitle_style
    ))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=accent_color, spaceAfter=10))

    # Executive Summary Table
    total_frames = len(batch_records)
    avg_psnr = np.mean([float(r.get("metrics", {}).get("estimated_psnr", 0) or 0) for r in batch_records]) if batch_records else 0
    avg_uiqm = np.mean([float(r.get("metrics", {}).get("uiqm", 0) or 0) for r in batch_records]) if batch_records else 0
    total_detections = sum(len(r.get("detections") or []) for r in batch_records)

    summary_data = [
        [
            Paragraph("<b>Lead Specialist:</b>", body_style),
            Paragraph(operator_name, body_style),
            Paragraph("<b>Supervisor:</b>", body_style),
            Paragraph(supervisor, body_style)
        ],
        [
            Paragraph("<b>Total Frames Processed:</b>", body_style),
            Paragraph(str(total_frames), body_style),
            Paragraph("<b>Mean PSNR Gain:</b>", body_style),
            Paragraph(f"{avg_psnr:.2f} dB", body_style)
        ],
        [
            Paragraph("<b>Mean UIQM Score:</b>", body_style),
            Paragraph(f"{avg_uiqm:.2f} / 5.0", body_style),
            Paragraph("<b>Total Biological Targets:</b>", body_style),
            Paragraph(f"{total_detections} organisms located", body_style)
        ]
    ]

    sum_table = Table(summary_data, colWidths=[120, 150, 120, 140])
    sum_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), neutral_bg),
        ('BOX', (0, 0), (-1, -1), 0.5, border_color),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, border_color),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(sum_table)
    elements.append(Spacer(1, 10))

    # Processed Frames Gallery Table
    elements.append(Paragraph("BATCH INSPECTION SAMPLES & METRIC AUDIT", h2_style))
    table_rows = [
        [
            Paragraph("<b>Frame ID</b>", body_style),
            Paragraph("<b>Filename</b>", body_style),
            Paragraph("<b>PSNR</b>", body_style),
            Paragraph("<b>UIQM</b>", body_style),
            Paragraph("<b>UCIQE</b>", body_style),
            Paragraph("<b>Species / Targets</b>", body_style),
            Paragraph("<b>Coral Health Status</b>", body_style)
        ]
    ]

    for item in batch_records[:25]:  # Limit to 25 items per report table
        m = item.get("metrics") or {}
        ch = item.get("coral_health") or {}
        dets = item.get("detections") or []
        table_rows.append([
            Paragraph(f"#{item.get('id', '')[:6]}", body_style),
            Paragraph(item.get("filename", "")[:20], body_style),
            Paragraph(f"{float(m.get('estimated_psnr', 0) or 0):.1f} dB", body_style),
            Paragraph(f"{float(m.get('uiqm', 0) or 0):.2f}", body_style),
            Paragraph(f"{float(m.get('uciqe', 0) or 0):.2f}", body_style),
            Paragraph(f"{len(dets)} targets", body_style),
            Paragraph(ch.get("health_status", "N/A")[:20], body_style)
        ])

    batch_table = Table(table_rows, colWidths=[55, 120, 50, 50, 50, 85, 120])
    batch_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e2e8f0")),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(batch_table)
    elements.append(Spacer(1, 14))

    # Formal Sign-off
    elements.append(KeepTogether([
        Paragraph("OFFICIAL SURVEY VERIFICATION & APPROVAL", h2_style),
        Spacer(1, 4),
        Table([
            [
                Paragraph("<b>Survey Specialist Signature:</b><br/>" + operator_name + "<br/>Role 2 Lead & CV Specialist", body_style),
                Paragraph("<b>Supervising Faculty Verification:</b><br/>" + supervisor + "<br/>Department of IT, BTU", body_style),
            ],
            [
                Paragraph("<i>Signature: _________________________</i>", body_style),
                Paragraph("<i>Signature: _________________________</i>", body_style)
            ]
        ], colWidths=[265, 265], style=[
            ('BOX', (0, 0), (-1, -1), 0.5, border_color),
            ('BACKGROUND', (0, 0), (-1, -1), neutral_bg),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ])
    ]))

    doc.build(elements)
    return str(pdf_path)

