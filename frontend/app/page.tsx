async function getData() {
  const res = await fetch('http://localhost:3001/test');
  return res.text();
}

export default async function Home() {
  const data = await getData();

  return (
    <main>
      <h1>{data}</h1>
    </main>
  );
}
