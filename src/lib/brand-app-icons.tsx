import { ImageResponse } from "next/og";

/** WPBL lockup cream/gold on black */
const WPBL_INK = "#0A0A0A";
const WPBL_MARK = "#C9A882";

/** Radar ATC-lite palette */
const RADAR_BG = "#0B0F14";
const RADAR_RING = "#1A4A1A";
const RADAR_ACCENT = "#3D9CF0";
const RADAR_SWEEP = "#00FF00";

export function wpblAppIcon(size: number): ImageResponse {
  const fontSize = Math.round(size * 0.62);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: WPBL_INK,
          color: WPBL_MARK,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize,
            fontWeight: 700,
            letterSpacing: size > 64 ? -2 : -1,
            lineHeight: 1,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          W
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}

export function radarAppIcon(size: number): ImageResponse {
  const cx = size / 2;
  const cy = size / 2;
  const r1 = size * 0.16;
  const r2 = size * 0.28;
  const r3 = size * 0.4;
  const stroke = Math.max(1.25, size * 0.04);
  // Larger plane at favicon size so the mark stays readable.
  const plane = size <= 48 ? size * 0.34 : size * 0.24;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: RADAR_BG,
          position: "relative",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: "absolute", inset: 0 }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={r3}
            fill="none"
            stroke={RADAR_RING}
            strokeWidth={stroke}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r2}
            fill="none"
            stroke={RADAR_RING}
            strokeWidth={stroke}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r1}
            fill="none"
            stroke={RADAR_RING}
            strokeWidth={stroke}
          />
          <path
            d={`M ${cx} ${cy} L ${cx + r3 * 0.15} ${cy - r3} A ${r3} ${r3} 0 0 1 ${cx + r3 * 0.72} ${cy - r3 * 0.7} Z`}
            fill={RADAR_SWEEP}
            opacity={0.35}
          />
          <line
            x1={cx}
            y1={cy}
            x2={cx + r3 * 0.72}
            y2={cy - r3 * 0.7}
            stroke={RADAR_SWEEP}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Top-down aircraft mark */}
          <g transform={`translate(${cx}, ${cy})`}>
            <path
              d={`M 0 ${-plane * 0.55}
                L ${plane * 0.14} ${-plane * 0.08}
                L ${plane * 0.58} ${plane * 0.08}
                L ${plane * 0.14} ${plane * 0.14}
                L ${plane * 0.2} ${plane * 0.48}
                L 0 ${plane * 0.34}
                L ${-plane * 0.2} ${plane * 0.48}
                L ${-plane * 0.14} ${plane * 0.14}
                L ${-plane * 0.58} ${plane * 0.08}
                L ${-plane * 0.14} ${-plane * 0.08}
                Z`}
              fill={RADAR_ACCENT}
            />
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
