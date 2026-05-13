async function test() {
  console.log("Fetching n8n...");
  const n8nUrl = "https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_pacientes";
  const n8nResponse = await fetch(n8nUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  console.log("Status:", n8nResponse.status);
  const text = await n8nResponse.text();
  console.log("Body:", text.substring(0, 500));
}
test();
