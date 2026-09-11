import { Injectable } from '@nestjs/common';
import { ChannelPort } from './channel.port';

@Injectable()
export class WhatsappChannel implements ChannelPort {
  channel = 'WHATSAPP' as const;
  async send(to: string, _subject: string | null, body: string, meta: { locale: string; idempotencyKey: string; templateName?: string | null }) {
    // Cloud API officielle
    // POST https://graph.facebook.com/v20.0/{PHONE_ID}/messages
    // Headers: Authorization: Bearer {WHATSAPP_TOKEN}
    // Body: { messaging_product:"whatsapp", to, type:"template", template:{ name: templateName, language:{code: localeMap[meta.locale]}, components:[{type:"body", parameters: bodyVars }] } }
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const token = process.env.WHATSAPP_TOKEN;
    if (!phoneId || !token) {
      // stub for dev
      console.log(`[WHATSAPP] mock to=${to} template=${meta.templateName} body=${body.slice(0,60)}`);
      return { providerRef: `wamid.${meta.idempotencyKey.slice(0,8)}` };
    }
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace('+',''),
        type: 'template',
        template: {
          name: meta.templateName ?? 'kredit_approved_fr',
          language: { code: this.toWhatsAppLang(meta.locale) },
          components: [{ type:'body', parameters: this.bodyToParams(body) }]
        }
      })
    });
    if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
    const json: any = await res.json();
    return { providerRef: json.messages?.[0]?.id ?? `wamid.${Date.now()}` };
  }
  private toWhatsAppLang(locale: string) {
    const map: Record<string,string> = { fr:'fr', en:'en_US', nl:'nl', de:'de' };
    return map[locale] ?? 'fr';
  }
  private bodyToParams(body: string) {
    // body contains {{1}},{{2}} already interpolated; for template we split vars
    // Simplified: body is final string → send as text fallback if no template
    return [{ type:'text', text: body.slice(0, 1024)}];
  }
  isTransientError(err: any) { return err?.status === 429 || err?.status >= 500; }
}
