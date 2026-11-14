import { z } from 'zod';
import { websiteInquirySchema } from './verification';

const responseSchema = z.object({
  id: z.string().regex(/^[1-9][0-9]{0,63}$/),
  form_id: z.string().regex(/^[1-9][0-9]{0,63}$/),
  field_data: z
    .array(z.object({ name: z.string().max(80), values: z.array(z.string().max(4000)).length(1) }))
    .max(40),
});
/** Fixed provider URL and injectable transport. This app supplies synthetic transport only. */
export async function retrieveMetaInquiry(
  id: string,
  form: string,
  version: string,
  transport: (url: string) => Promise<unknown>,
) {
  if (
    !/^[1-9][0-9]{0,63}$/.test(id) ||
    !/^[1-9][0-9]{0,63}$/.test(form) ||
    !/^v[1-9][0-9]?\.0$/.test(version)
  )
    throw new Error('Invalid provider binding.');
  const url = `https://graph.facebook.com/${version}/${id}?fields=id,form_id,field_data`;
  const data = responseSchema.parse(await transport(url));
  if (data.id !== id || data.form_id !== form) throw new Error('Provider identity mismatch.');
  const fields: Record<string, string> = {};
  for (const field of data.field_data) {
    if (field.name in fields) throw new Error('Ambiguous provider field.');
    fields[field.name] = field.values[0];
  }
  return websiteInquirySchema.parse({
    customer_name: fields.full_name,
    email: fields.email?.toLowerCase() ?? null,
    phone: fields.phone_number?.replace(/[\s().-]/g, '') ?? null,
  });
}