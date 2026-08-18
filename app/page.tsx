"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataConnection, Peer as PeerInstance } from "peerjs";

const TOTAL_SECONDS = 15 * 60;
const slideTitles = [
  "Capa & abertura",
  "Sobre a obra",
  "Curiosidades & trechos",
  "Conhecimento adquirido",
  "Encerramento",
];

type ControllerConfig = {
  presenterId: string;
  token: string;
};

type RemoteStatus = "idle" | "creating" | "waiting" | "connected" | "error";

type PresentationState = {
  kind: "state";
  started: boolean;
  slide: number;
  seconds: number;
  paused: boolean;
};

type RemoteAction = "start" | "cover" | "previous" | "next" | "goto" | "toggle-timer" | "reset-timer";

type RemoteCommand = {
  kind: "command";
  action: RemoteAction;
  index?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function createRandomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function RemoteController({ presenterId, token }: ControllerConfig) {
  const connectionRef = useRef<DataConnection | null>(null);
  const peerRef = useRef<PeerInstance | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [presentation, setPresentation] = useState<PresentationState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const connectionTimeout = window.setTimeout(() => {
      setConnectionStatus((current) => current === "connecting" ? "error" : current);
    }, 12000);

    async function connect() {
      try {
        const { Peer } = await import("peerjs");
        if (cancelled) return;

        const peer = new Peer(`controle-${createRandomId()}`);
        peerRef.current = peer;

        peer.on("open", () => {
          if (cancelled) return;
          const connection = peer.connect(presenterId, { reliable: true });
          connectionRef.current = connection;

          connection.on("open", () => {
            connection.send({ kind: "auth", token });
          });

          connection.on("data", (data) => {
            if (!isObject(data) || data.kind !== "state") return;
            window.clearTimeout(connectionTimeout);
            setPresentation(data as PresentationState);
            setConnectionStatus("connected");
          });

          connection.on("close", () => setConnectionStatus("error"));
          connection.on("error", () => setConnectionStatus("error"));
        });

        peer.on("error", (error) => {
          console.warn("Controle remoto: falha de conexão", error.type, error.message);
          setConnectionStatus("error");
        });
      } catch {
        setConnectionStatus("error");
      }
    }

    void connect();
    return () => {
      cancelled = true;
      window.clearTimeout(connectionTimeout);
      connectionRef.current?.close();
      peerRef.current?.destroy();
    };
  }, [presenterId, token]);

  const sendCommand = useCallback((action: RemoteAction, index?: number) => {
    if (!connectionRef.current?.open) return;
    const command: RemoteCommand = { kind: "command", action };
    if (typeof index === "number") command.index = index;
    connectionRef.current.send(command);
  }, []);

  const currentSlide = presentation?.slide ?? 0;
  const isStarted = presentation?.started ?? false;

  return (
    <main className="remote-controller-shell">
      <div className="noise" aria-hidden="true" />
      <section className="remote-controller-card">
        <header className="remote-controller-header">
          <div>
            <p className="remote-eyebrow">Controle da apresentação</p>
            <h1>Cartas de um Diabo<br />a seu Aprendiz</h1>
          </div>
          <span className={`remote-connection remote-connection-${connectionStatus}`}>
            <i aria-hidden="true" />
            {connectionStatus === "connected" ? "Conectado" : connectionStatus === "error" ? "Conexão perdida" : "Conectando"}
          </span>
        </header>

        <div className="remote-time" aria-live="polite">
          <span>{presentation?.paused ? "Tempo pausado" : "Tempo restante"}</span>
          <strong>{formatTime(presentation?.seconds ?? TOTAL_SECONDS)}</strong>
        </div>

        {!isStarted ? (
          <button className="remote-start" onClick={() => sendCommand("start")} disabled={connectionStatus !== "connected"}>
            Iniciar apresentação
          </button>
        ) : (
          <>
            <div className="remote-slide-copy">
              <span>Slide {currentSlide + 1} de {slideTitles.length}</span>
              <strong>{slideTitles[currentSlide]}</strong>
            </div>

            <div className="remote-primary-actions">
              <button onClick={() => sendCommand("previous")} disabled={connectionStatus !== "connected" || currentSlide === 0} aria-label="Slide anterior">
                <span aria-hidden="true">←</span>
                Anterior
              </button>
              <button className="remote-next" onClick={() => sendCommand("next")} disabled={connectionStatus !== "connected" || currentSlide === slideTitles.length - 1} aria-label="Próximo slide">
                Próximo
                <span aria-hidden="true">→</span>
              </button>
            </div>

            <div className="remote-slide-grid" aria-label="Ir diretamente para um slide">
              {slideTitles.map((title, index) => (
                <button key={title} className={index === currentSlide ? "active" : ""} onClick={() => sendCommand("goto", index)} disabled={connectionStatus !== "connected"}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {title}
                </button>
              ))}
            </div>

            <div className="remote-secondary-actions">
              <button onClick={() => sendCommand("toggle-timer")} disabled={connectionStatus !== "connected" || currentSlide === slideTitles.length - 1}>
                {presentation?.paused ? "Retomar tempo" : "Pausar tempo"}
              </button>
              <button onClick={() => sendCommand("reset-timer")} disabled={connectionStatus !== "connected"}>Reiniciar 15 min</button>
              <button onClick={() => sendCommand("cover")} disabled={connectionStatus !== "connected"}>Voltar à capa</button>
            </div>
          </>
        )}

        {connectionStatus === "error" && (
          <p className="remote-error">A sessão foi interrompida. Reabra o leitor de QR Code e escaneie novamente o código exibido no computador.</p>
        )}
      </section>
    </main>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <span className="placeholder-text">{children}</span>;
}

export default function Home() {
  const [controllerConfig, setControllerConfig] = useState<ControllerConfig | null | undefined>(undefined);
  const [started, setStarted] = useState(false);
  const [slide, setSlide] = useState(0);
  const [seconds, setSeconds] = useState(TOTAL_SECONDS);
  const [timerManuallyPaused, setTimerManuallyPaused] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>("idle");
  const [remoteQr, setRemoteQr] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const peerRef = useRef<PeerInstance | null>(null);
  const remoteConnectionsRef = useRef(new Set<DataConnection>());
  const remoteTokenRef = useRef("");
  const presentationStateRef = useRef<PresentationState>({
    kind: "state",
    started: false,
    slide: 0,
    seconds: TOTAL_SECONDS,
    paused: false,
  });

  useEffect(() => {
    const parseUrl = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("controle") !== "1") {
        setControllerConfig(null);
        return;
      }

      const presenterId = params.get("sala");
      const token = params.get("chave");
      setControllerConfig(presenterId && token ? { presenterId, token } : null);
    }, 0);

    return () => window.clearTimeout(parseUrl);
  }, []);

  const goTo = useCallback((next: number) => {
    setSlide(Math.max(0, Math.min(slideTitles.length - 1, next)));
  }, []);

  const startPresentation = useCallback(() => {
    setSlide(0);
    setSeconds(TOTAL_SECONDS);
    setTimerManuallyPaused(false);
    setStarted(true);
  }, []);

  const returnToCover = useCallback(() => {
    setStarted(false);
    setSlide(0);
    setSeconds(TOTAL_SECONDS);
    setTimerManuallyPaused(false);
  }, []);

  const handleRemoteCommand = useCallback((command: RemoteCommand) => {
    switch (command.action) {
      case "start":
        startPresentation();
        break;
      case "cover":
        returnToCover();
        break;
      case "previous":
        setSlide((current) => Math.max(0, current - 1));
        break;
      case "next":
        setSlide((current) => Math.min(slideTitles.length - 1, current + 1));
        break;
      case "goto":
        if (typeof command.index === "number") goTo(command.index);
        break;
      case "toggle-timer":
        setTimerManuallyPaused((current) => !current);
        break;
      case "reset-timer":
        setSeconds(TOTAL_SECONDS);
        setTimerManuallyPaused(false);
        break;
    }
  }, [goTo, returnToCover, startPresentation]);

  const createRemoteSession = useCallback(async () => {
    if (peerRef.current && !peerRef.current.destroyed) return;

    setRemoteStatus("creating");
    setRemoteQr("");

    try {
      const [{ Peer }, QRCode] = await Promise.all([import("peerjs"), import("qrcode")]);
      const roomId = `cartas-${createRandomId()}`;
      const token = createRandomId();
      remoteTokenRef.current = token;

      const controllerUrl = new URL(window.location.href);
      controllerUrl.search = "";
      controllerUrl.hash = "";
      controllerUrl.searchParams.set("controle", "1");
      controllerUrl.searchParams.set("sala", roomId);
      controllerUrl.searchParams.set("chave", token);

      const controllerUrlText = controllerUrl.toString();
      setRemoteUrl(controllerUrlText);
      setRemoteQr(await QRCode.toDataURL(controllerUrlText, {
        width: 520,
        margin: 2,
        color: { dark: "#15100a", light: "#f4efe7" },
        errorCorrectionLevel: "M",
      }));

      const peer = new Peer(roomId);
      peerRef.current = peer;

      const pairingTimeout = window.setTimeout(() => {
        setRemoteStatus((current) => current === "creating" ? "error" : current);
      }, 12000);

      peer.on("open", () => {
        window.clearTimeout(pairingTimeout);
        setRemoteStatus("waiting");
      });

      peer.on("connection", (connection) => {
        let authorized = false;

        connection.on("data", (data) => {
          if (!isObject(data)) return;

          if (!authorized && data.kind === "auth" && data.token === remoteTokenRef.current) {
            authorized = true;
            remoteConnectionsRef.current.add(connection);
            setRemoteStatus("connected");
            connection.send(presentationStateRef.current);
            return;
          }

          if (authorized && data.kind === "command" && typeof data.action === "string") {
            handleRemoteCommand(data as RemoteCommand);
          }
        });

        connection.on("close", () => {
          remoteConnectionsRef.current.delete(connection);
          setRemoteStatus(remoteConnectionsRef.current.size ? "connected" : "waiting");
        });
      });

      peer.on("disconnected", () => {
        if (peer.destroyed) return;
        setRemoteStatus("creating");
        window.setTimeout(() => {
          if (!peer.destroyed && peer.disconnected) peer.reconnect();
        }, 900);
      });

      peer.on("error", (error) => {
        window.clearTimeout(pairingTimeout);
        console.warn("Apresentação: falha de conexão remota", error.type, error.message);
        setRemoteStatus("error");
      });
    } catch {
      setRemoteStatus("error");
    }
  }, [handleRemoteCommand]);

  const openRemote = useCallback(() => {
    setRemoteOpen(true);
    void createRemoteSession();
  }, [createRemoteSession]);

  const stopRemote = useCallback(() => {
    for (const connection of remoteConnectionsRef.current) connection.close();
    remoteConnectionsRef.current.clear();
    peerRef.current?.destroy();
    peerRef.current = null;
    remoteTokenRef.current = "";
    setRemoteQr("");
    setRemoteUrl("");
    setRemoteStatus("idle");
    setRemoteOpen(false);
  }, []);

  const retryRemote = useCallback(() => {
    stopRemote();
    setRemoteOpen(true);
    window.setTimeout(() => void createRemoteSession(), 0);
  }, [createRemoteSession, stopRemote]);

  useEffect(() => () => {
    for (const connection of remoteConnectionsRef.current) connection.close();
    peerRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!started || timerManuallyPaused || slide === slideTitles.length - 1) return;
    const timer = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [slide, started, timerManuallyPaused]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!started && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        startPresentation();
        return;
      }
      if (!started) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        setSlide((current) => Math.min(slideTitles.length - 1, current + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setSlide((current) => Math.max(0, current - 1));
      }
      if (event.key === "Home") setSlide(0);
      if (event.key === "End") setSlide(slideTitles.length - 1);
      if (event.key === "Escape") returnToCover();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [returnToCover, startPresentation, started]);

  const isTimerPaused = timerManuallyPaused || (started && slide === slideTitles.length - 1 && seconds > 0);

  useEffect(() => {
    presentationStateRef.current = {
      kind: "state",
      started,
      slide,
      seconds,
      paused: isTimerPaused,
    };

    for (const connection of remoteConnectionsRef.current) {
      if (connection.open) connection.send(presentationStateRef.current);
    }
  }, [isTimerPaused, seconds, slide, started]);

  const time = useMemo(() => formatTime(seconds), [seconds]);

  if (controllerConfig === undefined) {
    return <main className="remote-loading" aria-label="Carregando apresentação" />;
  }

  if (controllerConfig) {
    return <RemoteController {...controllerConfig} />;
  }

  if (!started) {
    return (
      <main className="landing-shell">
        <div className="noise" aria-hidden="true" />
        <button className="book-stage" onClick={startPresentation} aria-label="Iniciar apresentação">
          <span className="book-shadow" aria-hidden="true" />
          <span className="book-image-frame">
            <span className="cover-art" aria-hidden="true" style={{ backgroundImage: 'url("./book-cover-art.webp")' }} />
            <span className="cover-copy">
              <span className="cover-title-small">Cartas de um</span>
              <strong>diabo</strong>
              <span className="cover-title-small">a seu aprendiz</span>
              <span className="cover-divider" aria-hidden="true" />
              <span className="cover-author">C. S.<br />Lewis</span>
            </span>
          </span>
          <span className="start-hint">Clique para iniciar</span>
        </button>
      </main>
    );
  }

  const isWarning = seconds <= 120 && seconds > 0;
  const isOver = seconds === 0;
  const isPaused = isTimerPaused && !isOver;

  return (
    <main className="presentation-shell">
      <div className="noise" aria-hidden="true" />
      <div className="corner corner-tl" aria-hidden="true">❦</div>
      <div className="corner corner-tr" aria-hidden="true">❦</div>
      <div className="corner corner-bl" aria-hidden="true">❦</div>
      <div className="corner corner-br" aria-hidden="true">❦</div>
      <div className="engraving engraving-quill" aria-hidden="true">✒</div>
      <div className="engraving engraving-scroll" aria-hidden="true">❧</div>

      <header className="presentation-header">
        <button className="cover-link" onClick={returnToCover} aria-label="Voltar à capa">
          <span aria-hidden="true">✦</span>
          <span>Cartas de um Diabo a seu Aprendiz</span>
        </button>
        <div className="presentation-actions">
          <button className={`remote-open remote-open-${remoteStatus}`} onClick={openRemote} aria-label="Abrir controle remoto pelo celular">
            <span className="remote-open-icon" aria-hidden="true">⌁</span>
            <span>{remoteStatus === "connected" ? "Celular conectado" : "Controle remoto"}</span>
            <i aria-hidden="true" />
          </button>
          <div className={`timer ${isWarning ? "timer-warning" : ""} ${isOver ? "timer-over" : ""}`} role="timer" aria-live={isWarning || isOver || isPaused ? "polite" : "off"}>
            <span className="timer-icon" aria-hidden="true">◷</span>
            <span className="timer-copy">
              <span>{isOver ? "Tempo encerrado" : isPaused ? "Tempo pausado" : "Tempo restante"}</span>
              <strong>{time}</strong>
            </span>
          </div>
        </div>
      </header>

      <section className="slide-viewport" aria-live="polite">
        <article key={slide} className="slide-card">
          <div className="paper-texture" aria-hidden="true" />
          <div className="slide-kicker">
            <span>Parte {String(slide + 1).padStart(2, "0")}</span>
            <span className="kicker-line" />
            <span>{slideTitles[slide]}</span>
          </div>

          {slide === 0 && (
            <div className="slide-one slide-content">
              <div className="opening-copy">
                <p className="author-display">C. S. <strong>Lewis</strong></p>
                <h1>Cartas de um <em>diabo</em><br />a seu aprendiz</h1>
                <p className="author-line">1942</p>
                <div className="bio-block">
                  <span className="field-label">Biografia</span>
                  <p><Placeholder>[INSERIR BREVE BIOGRAFIA DO AUTOR]</Placeholder></p>
                </div>
              </div>
              <div className="author-visual">
                <img
                  className="author-illustration"
                  src="./lewis-engraving.webp"
                  alt="Retrato ilustrado de C. S. Lewis escrevendo à mesa"
                />
                <span className="photo-caption">Retrato ilustrado · Clive Staples Lewis · 1898—1963</span>
              </div>
            </div>
          )}

          {slide === 1 && (
            <div className="slide-two slide-content">
              <div className="section-heading">
                <span className="heading-number">II</span>
                <div><p className="eyebrow">Contexto literário</p><h1>Sobre a obra</h1></div>
              </div>
              <div className="work-grid">
                <div className="work-feature">
                  <span className="field-label">Objetivo da obra</span>
                  <p><Placeholder>[INSERIR OBJETIVO DA OBRA]</Placeholder></p>
                </div>
                <div className="work-meta">
                  <div><span className="field-label">Categoria / gênero</span><p><Placeholder>[INSERIR GÊNERO]</Placeholder></p></div>
                  <div><span className="field-label">Tema central</span><p><Placeholder>[INSERIR TEMA CENTRAL]</Placeholder></p></div>
                </div>
                <div className="plot-block">
                  <span className="field-label">Enredo</span>
                  <p><Placeholder>[INSERIR RESUMO DO ENREDO]</Placeholder></p>
                  <p><Placeholder>[CONTINUAÇÃO DO RESUMO, SE NECESSÁRIO]</Placeholder></p>
                </div>
              </div>
            </div>
          )}

          {slide === 2 && (
            <div className="slide-three slide-content">
              <div className="section-heading compact-heading">
                <span className="heading-number">III</span>
                <div><p className="eyebrow">Entrelinhas</p><h1>Curiosidades & trechos</h1></div>
              </div>
              <div className="curiosity-layout">
                <div className="curiosity-list">
                  {[1, 2, 3].map((item) => (
                    <div className="curiosity-item" key={item}>
                      <span>{String(item).padStart(2, "0")}</span>
                      <p><Placeholder>[INSERIR CURIOSIDADE SOBRE O LIVRO OU AUTOR]</Placeholder></p>
                    </div>
                  ))}
                </div>
                <div className="excerpt-list" aria-label="Três trechos selecionados da obra">
                  {[1, 2, 3].map((item) => (
                    <blockquote className="excerpt-card" key={item}>
                      <span className="excerpt-number">Trecho {String(item).padStart(2, "0")}</span>
                      <span className="quote-mark" aria-hidden="true">“</span>
                      <p><Placeholder>[INSERIR TRECHO OU CITAÇÃO DO LIVRO]</Placeholder></p>
                      <footer>— <Placeholder>[CARTA / REFERÊNCIA]</Placeholder></footer>
                    </blockquote>
                  ))}
                </div>
              </div>
            </div>
          )}

          {slide === 3 && (
            <div className="slide-four slide-content">
              <div className="reflection-title">
                <span className="feather" aria-hidden="true">✒</span>
                <p className="eyebrow">Reflexão pessoal</p>
                <h1>Conhecimento<br />adquirido</h1>
                <span className="ornament-rule"><i>✦</i></span>
              </div>
              <div className="reflection-paper">
                <span className="field-label">Notas do apresentador</span>
                <p><Placeholder>[INSERIR REFLEXÃO PESSOAL SOBRE A LEITURA]</Placeholder></p>
                <p><Placeholder>[DESCREVER O PRINCIPAL APRENDIZADO ADQUIRIDO]</Placeholder></p>
                <p><Placeholder>[RELACIONAR A OBRA A UMA EXPERIÊNCIA OU IDEIA PESSOAL]</Placeholder></p>
                <span className="signature-line">Reflexões</span>
              </div>
            </div>
          )}

          {slide === 4 && (
            <div className="slide-five slide-content">
              <div className="closing-emblem" aria-hidden="true"><span className="emblem-ring">✦</span></div>
              <p className="eyebrow">Fim da correspondência</p>
              <h1>Obrigado pela atenção.</h1>
              <p className="closing-subtitle">Perguntas, comentários ou reflexões?</p>
              <div className="contact-placeholder">
                <span className="field-label">Contato opcional</span>
                <Placeholder>[INSERIR CONTATO OU INFORMAÇÃO FINAL]</Placeholder>
              </div>
              <div className="closing-flourish" aria-hidden="true">❦</div>
            </div>
          )}
        </article>
      </section>

      <footer className="presentation-controls">
        <button className="nav-button" onClick={() => goTo(slide - 1)} disabled={slide === 0} aria-label="Slide anterior">
          <span aria-hidden="true">←</span><span>Anterior</span>
        </button>
        <div className="progress-wrap">
          <div className="progress-label">
            <span>Slide {slide + 1} de {slideTitles.length}</span>
            <span>{Math.round(((slide + 1) / slideTitles.length) * 100)}%</span>
          </div>
          <div className="progress-track"><span style={{ width: `${((slide + 1) / slideTitles.length) * 100}%` }} /></div>
          <div className="progress-dots" aria-label="Escolher slide">
            {slideTitles.map((title, index) => (
              <button key={title} className={index === slide ? "active" : ""} onClick={() => goTo(index)} aria-label={`Ir para ${title}`} aria-current={index === slide ? "step" : undefined} />
            ))}
          </div>
        </div>
        <button className="nav-button nav-next" onClick={() => goTo(slide + 1)} disabled={slide === slideTitles.length - 1} aria-label="Próximo slide">
          <span>Próximo</span><span aria-hidden="true">→</span>
        </button>
      </footer>

      {remoteOpen && (
        <div className="remote-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setRemoteOpen(false);
        }}>
          <section className="remote-modal" role="dialog" aria-modal="true" aria-labelledby="remote-modal-title">
            <button className="remote-modal-close" onClick={() => setRemoteOpen(false)} aria-label="Fechar">×</button>
            <div className="remote-modal-copy">
              <p className="remote-eyebrow">Controle pelo celular</p>
              <h2 id="remote-modal-title">Escaneie para assumir o controle</h2>
              <ol>
                <li>Conecte o celular à internet.</li>
                <li>Abra a câmera e aponte para o QR Code.</li>
                <li>Mantenha esta apresentação aberta no computador.</li>
              </ol>
              <p className={`remote-modal-status remote-modal-status-${remoteStatus}`}>
                <i aria-hidden="true" />
                {remoteStatus === "connected"
                  ? "Celular conectado. Você já pode fechar esta janela."
                  : remoteStatus === "waiting"
                    ? "Aguardando o celular escanear o código…"
                    : remoteStatus === "error"
                      ? "Não foi possível criar a sessão. Tente gerar outra."
                      : "Criando uma sessão segura…"}
              </p>
              <div className="remote-modal-actions">
                {remoteUrl && (
                  <button data-controller-url={remoteUrl} onClick={() => void navigator.clipboard?.writeText(remoteUrl)}>Copiar link</button>
                )}
                <button className="remote-end" onClick={remoteStatus === "error" ? retryRemote : stopRemote}>{remoteStatus === "error" ? "Tentar novamente" : "Encerrar sessão"}</button>
              </div>
            </div>
            <div className="remote-qr-wrap">
              {remoteQr ? <img src={remoteQr} alt="QR Code para abrir o controle remoto no celular" /> : <span className="remote-qr-loading" aria-hidden="true" />}
              <small>O código muda sempre que uma nova sessão é criada.</small>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
