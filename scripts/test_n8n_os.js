async function test() {
  console.log("Calling Edge Function inspect_os action...");
  const url = "https://drbzogwimvaziaydwqfk.supabase.co/functions/v1/sync-ordem-servico";
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYnpvZ3dpbXZhemlheWR3cWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NTg5MzIsImV4cCI6MjA5MTQzNDkzMn0.lpt8rnIy0NjdX11T3P12_YzGzyotwJ2WvRK_GiDivlI'
      },
      body: JSON.stringify({
        action: 'inspect_os'
      })
    });
    const result = await response.json();
    console.log("OS Principal na tabela ordem_servico:");
    console.log(result.osData);
    console.log("\nRegistros na tabela historico_ordem_servico:");
    console.log(result.histData);
  } catch (err) {
    console.error("Erro na chamada inspect_os:", err);
  }
}
test();
