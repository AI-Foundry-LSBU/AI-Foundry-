import { useEffect, useId, useRef, useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { Button } from "./ui";
import { requestApi } from "../data/apiRequest";
import { greetingMessage, solutionReply } from "../data/solutionChat";

function AliceAvatar() {
  return <svg className="alice-avatar" viewBox="0 0 40 40" role="img" aria-label="Alice">
    <circle cx="20" cy="20" r="20" fill="#c44f88" />
    <circle cx="20" cy="16" r="6.5" fill="#fff7f8" />
    <path d="M7 35c2.2-7.2 7-11 13-11s10.8 3.8 13 11" fill="#fff7f8" />
  </svg>;
}

export function SolutionChat({ onContinue }) {
  const [messages, setMessages] = useState(() => [greetingMessage()]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const logRef = useRef(null);
  const requestRef = useRef(null);
  const inputId = useId();
  const waiting = typing;
  const hasUserMessage = messages.some((message) => message.role === "user");

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [messages, typing]);

  const sendText = (value) => {
    const text = value.trim();
    if (!text || waiting) return;
    const userMessage = { id: crypto.randomUUID(), role: "user", text };
    const showedSolutions = messages.some((message) => message.solutions?.length);
    const last = [...messages].reverse().find((message) => message.role === "assistant");
    setMessages([...messages, userMessage]);
    setDraft("");
    setTyping(true);

    const rejected = (showedSolutions || last?.kind === "clarify")
      && /none of these|not these|does not cover|doesn't cover|do not cover|don't cover|still need|not what i|something else|no suitable/.test(text.toLowerCase());
    if (rejected) {
      setMessages((current) => [...current, {
          id: crypto.randomUUID(),
          role: "assistant",
          kind: "none",
          text: "If these suggestions do not meet your needs, continue to the form and describe what is missing."
      }]);
      setTyping(false);
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const previousMessages = messages.filter((message) => message.kind !== "greeting")
      .slice(-8).map(({ role, text: messageText }) => ({ role, text: messageText }));
    requestApi("/solutions/check", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, previousMessages })
    }, "Existing services could not be checked. Please try again.").then((result) => {
      if (requestRef.current !== controller) return;
      const reply = solutionReply(result);
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", ...reply }]);
    }).catch((error) => {
      if (error.name === "AbortError" || requestRef.current !== controller) return;
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        kind: "none",
        text: "Existing services could not be checked. Please try again, or continue to the form."
      }]);
    }).finally(() => {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setTyping(false);
      }
    });
  };

  const restart = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setTyping(false);
    setDraft("");
    setMessages([greetingMessage()]);
  };

  const continueToForm = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setTyping(false);
    onContinue();
  };

  return <section className="solution-chat" aria-labelledby="solution-chat-title">
    <div className="solution-chat-bar">
      <div className="solution-identity">
        <AliceAvatar />
        <div>
          <h2 id="solution-chat-title">Alice</h2>
          <p>Looks up existing London South Bank University services</p>
        </div>
      </div>
      <div className="solution-chat-actions">
        <Button type="button" variant="secondary" icon={RotateCcw} onClick={restart} disabled={!hasUserMessage && !waiting}>
          Restart
        </Button>
        <Button type="button" variant="secondary" onClick={continueToForm}>
          Submit anyway
        </Button>
      </div>
    </div>

    {(messages.length > 0 || typing) && <div className="solution-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions">
      {messages.map((message) => <div className={`solution-turn solution-turn-${message.role}`} key={message.id}>
        {message.role === "assistant" && <AliceAvatar />}
        <article className={`solution-message solution-${message.role}`}>
          <span className="solution-who">{message.role === "user" ? "You" : "Alice"}</span>
          <p>{message.text}</p>
          {message.solutions?.length > 0 && <ul className="solution-cards">
            {message.solutions.map((solution) => <li key={solution.id}>
              <h3>{solution.name}</h3>
              <p>{solution.description}</p>
              <p className="solution-reason">{solution.reason}</p>
              {solution.href && <a href={solution.href} target="_blank" rel="noreferrer">Open {solution.name}</a>}
              {solution.accessInstructions && <p>{solution.accessInstructions}</p>}
            </li>)}
          </ul>}
          {(["none", "found"].includes(message.kind) || message.showFormAction) && <Button type="button" onClick={continueToForm}>
            {message.showFormAction ? "Open opportunity form" : "Submit anyway"}
          </Button>}
        </article>
      </div>)}
      {typing && <div className="solution-turn solution-turn-assistant">
        <AliceAvatar />
        <p className="solution-typing" role="status">
          <span className="solution-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="solution-who">Checking existing solutions</span>
        </p>
      </div>}
    </div>}

    <form className="solution-composer" onSubmit={(event) => {
      event.preventDefault();
      sendText(draft);
    }}>
      <label htmlFor={inputId}>Describe the problem</label>
      <div className="solution-composer-box">
        <textarea
          id={inputId}
          rows={2}
          value={draft}
          maxLength={800}
          placeholder="Describe the problem or what you are trying to achieve"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendText(draft);
            }
          }}
        />
        <Button type="submit" icon={Send} disabled={!draft.trim() || waiting}>
          Send
        </Button>
      </div>
    </form>
  </section>;
}
