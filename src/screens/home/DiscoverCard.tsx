export function DiscoverCard() {
  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          overflowX: "auto",
          gap: 20,
          border: "2px solid red",
        }}
      >
        <img
          src="/images/discover/tripmatch.png"
          style={{ width: 300, flex: "0 0 auto" }}
        />

        <img
          src="/images/discover/ai-powered.png"
          style={{ width: 300, flex: "0 0 auto" }}
        />

        <img
          src="/images/discover/places.png"
          style={{ width: 300, flex: "0 0 auto" }}
        />
      </div>
    </div>
  );
}