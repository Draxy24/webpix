export default function Flag({ code }: { code: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/24x18/${code.toLowerCase()}.png`}
      alt={code}
      style={{
        width: "20px",
        height: "15px",
        verticalAlign: "middle",
        borderRadius: "2px",
        marginRight: "4px",
      }}
    />
  );
}
