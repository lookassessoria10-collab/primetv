import { encode } from "uqr";

/** QR Code em SVG gerado localmente a partir de um contato real configurado. */
export function QrCode({
  value,
  size,
  color = "#3b1b0f",
  background = "transparent",
}: {
  value: string;
  size: number;
  color?: string;
  background?: string;
}) {
  const qr = encode(value, { ecc: "M", border: 0 });
  const n = qr.size;
  let d = "";
  for (let y = 0; y < n; y++) {
    const row = qr.data[y];
    for (let x = 0; x < n; x++) if (row[x]) d += `M${x},${y}h1v1h-1z`;
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label="QR Code">
      {background !== "transparent" && <rect width={n} height={n} fill={background} />}
      <path d={d} fill={color} />
    </svg>
  );
}
