async function test() {
  const url = "https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/trigger_n8n_sync_pacientes";
  console.log("Fetching Edge Function...");
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  console.log("Status:", response.status);
  const text = await response.text();
  console.log("Body:", text);
}
test();
