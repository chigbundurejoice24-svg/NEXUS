export default function handler(req: any, res: any) {
  res.json({ ok: true, message: "minimal handler working", ts: Date.now() });
}
