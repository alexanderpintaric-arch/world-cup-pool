import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "linear-gradient(145deg, #FB923C 0%, #EA580C 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 20,
            fontWeight: 700,
            fontStyle: "italic",
            fontFamily: "Georgia, 'Times New Roman', serif",
            lineHeight: 1,
            marginBottom: 1,
          }}
        >
          N
        </span>
      </div>
    ),
    { width: 32, height: 32 },
  );
}
