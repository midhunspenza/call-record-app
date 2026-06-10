export function SmsBubbles() {
  const bubbles = [
    { cls: "in", text: "Hi, can I port my number?", style: { top: 22, left: 20, animationDelay: "0s" } },
    { cls: "out", text: "Sending the port-in form now.", style: { top: 78, left: 90, animationDelay: "1.5s" } },
    { cls: "out", text: "Code: 4821", style: { top: 78, right: 32, animationDelay: "0.8s" } },
    { cls: "in", text: "Got it, thanks!", style: { bottom: 18, left: "36%", animationDelay: "2.2s" } },
  ] as const;

  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1.4px)",
          backgroundSize: "18px 18px",
        }}
      />
      {bubbles.map((b, i) => (
        <div
          key={i}
          className="absolute mono text-[13px] py-2 px-3.5 rounded-[18px] whitespace-nowrap animate-float"
          style={{
            ...b.style,
            letterSpacing: "-0.01em",
            background: b.cls === "in" ? "rgba(255,255,255,0.08)" : "#EA580C",
            color: "#fff",
            borderBottomLeftRadius: b.cls === "in" ? 6 : undefined,
            borderBottomRightRadius: b.cls === "out" ? 6 : undefined,
          }}
        >
          {b.text}
        </div>
      ))}
    </>
  );
}
