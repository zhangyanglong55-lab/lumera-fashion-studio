"use client";

export default function DifyChatbot() {
  const token = process.env.NEXT_PUBLIC_DIFY_CHATBOT_TOKEN;

  if (!token) {
    return null;
  }

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.difyChatbotConfig = {
  token: ${JSON.stringify(token)},
  baseUrl: 'https://udify.app',
  inputs: {},
  systemVariables: {},
  userVariables: {},
};`,
        }}
      />
      <script
        src="https://udify.app/embed.min.js"
        id={token}
        defer
      />
    </>
  );
}
