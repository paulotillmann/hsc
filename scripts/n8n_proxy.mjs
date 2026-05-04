import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const n8nUrl = "https://n8n.technocode.site/mcp-server/http";
const n8nToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4NDU4ZGEwMS01NjBkLTRhOTMtOWRiZC0zNDhiYmFlMjNmZGQiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6IjMyZWY2M2ZmLTBjNTAtNDk5YS1hYjRiLTBjYjFlMTE2ZDIyYSIsImlhdCI6MTc3NzY4ODQ1MX0.QapIc6Jnr60GsMC13jezjZpH853QGZg983Rjih3tG1k";

async function main() {
  // Conecta ao n8n via Streamable HTTP (protocolo correto para /mcp-server/http)
  const clientTransport = new StreamableHTTPClientTransport(new URL(n8nUrl), {
    requestInit: {
      headers: {
        "Authorization": `Bearer ${n8nToken}`
      }
    }
  });

  // Configura a comunicação local via Stdio (Terminal)
  const serverTransport = new StdioServerTransport();

  // Roteia mensagens do n8n (Server) para a IDE local (Client)
  clientTransport.onmessage = async (message) => {
    try {
      await serverTransport.send(message);
    } catch (e) {
      process.stderr.write(`[n8n-proxy] Erro ao enviar para stdio: ${e}\n`);
    }
  };

  // Roteia mensagens da IDE local (Client) para o n8n (Server)
  serverTransport.onmessage = async (message) => {
    try {
      await clientTransport.send(message);
    } catch (e) {
      process.stderr.write(`[n8n-proxy] Erro ao enviar para HTTP: ${e}\n`);
    }
  };

  clientTransport.onerror = (err) => {
    process.stderr.write(`[n8n-proxy] Erro de transporte HTTP: ${err}\n`);
  };

  serverTransport.onerror = (err) => {
    process.stderr.write(`[n8n-proxy] Erro de transporte Stdio: ${err}\n`);
  };

  // Inicia o cliente HTTP primeiro para garantir que a conexão remota está pronta
  await clientTransport.start();

  // Só depois inicia o servidor Stdio para começar a receber comandos da IDE
  await serverTransport.start();

  // Mantém o processo rodando
  process.on('SIGINT', async () => {
    await clientTransport.close();
    await serverTransport.close();
    process.exit(0);
  });
}

main().catch(err => {
  process.stderr.write(`[n8n-proxy] Erro fatal: ${err}\n`);
  process.exit(1);
});
