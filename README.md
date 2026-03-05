# fastq-viewer

FASTQ read viewer with per-base quality score heatmap, Q-score distribution, and read length statistics.

## Features

- Parses 4-line FASTQ records (header, sequence, +, quality)
- Per-base quality score heatmap (red to green color scale)
- Colored nucleotide display (A=green, T=red, G=gold, C=blue)
- Q20 and Q30 percentage calculation
- Read length distribution summary (min, max, avg)
- Mean quality score per read
- Text search across read headers
- Expandable read details with base-by-base quality
- Pagination for large files (50 reads per page)

## Supported Extensions

- `.fastq`
- `.fq`

## Installation

Install from the **Plugins** tab in the AutoPipe desktop app.
