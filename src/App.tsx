import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";


// 1. Typ wiadomości - musi pasować 1:1 do Twojej struktury `Message` w Ruście!
interface Message {
  role: string;
  content: string;
}

function App() {
  // Pamięć komponentu (stany)
  const [prompt, setPrompt] = useState("");
  const [odpowiedz, setOdpowiedz] = useState("");
  const [ladowanie, setLadowanie] = useState(false);

  // Funkcja wywoływana po kliknięciu przycisku "Wyślij"
  async function wyslijZapytanie() {
    if (!prompt.trim()) return; // Nie wysyłaj pustego tekstu

    setLadowanie(true);
    setOdpowiedz("");

    try {
      // Przygotowujemy tablicę z jedną wiadomością (taką jak oczekuje Rust: Vec<Message>)
      const historia: Message[] = [
        { role: "user", content: prompt }
      ];

      // --- TWOJE ZADANIE A: Wywołaj komendę Rusta ---
      // Użyj: await invoke<string>("NAZWA_FUNKCJI_Z_RUSTA", { messages: historia, model: "qwen3.5:9b" })
      const wynik = await invoke<string>("send_message", {
        messages: historia,
        model: "qwen3.5:9b",
      });

      // Zapisujemy odpowiedź modelu w stanie, żeby wyświetliła się na ekranie
      setOdpowiedz(wynik);
    } catch (blad) {
      // Jeśli Rust zwróci Err(...), wyświetlimy błąd tutaj
      setOdpowiedz("Błąd: " + String(blad));
    } finally {
      setLadowanie(false);
    }
  }

  // Wygląd okna (HTML wewnątrz Reacta)
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>Absolute Studio - Test</h2>

      {/* Pole tekstowe powiązane ze stanem `prompt` */}
      <textarea
        rows={4}
        style={{ width: "100%", padding: "10px" }}
        placeholder="Napisz polecenie dla modelu..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <br /><br />

      {/* Przycisk wywołujący naszą funkcję */}
      <button onClick={wyslijZapytanie} disabled={ladowanie}>
        {ladowanie ? "Model myśli..." : "Wyślij do Ollamy"}
      </button>

      {/* Wyświetlenie odpowiedzi */}
      {odpowiedz && (
        <div style={{ marginTop: "20px", padding: "15px", background: "#222", color: "#fff", whiteSpace: "pre-wrap" }}>
          <strong>Odpowiedź AI:</strong>
          <p>{odpowiedz}</p>
        </div>
      )}
    </div>
  );
}

export default App;