// Insert the client's approved documents here. Empty documents are never
// presented as policies and never create footer links.
export type LegalDocument = { title: string; updated: string; sections: { heading: string; paragraphs: string[] }[] }
export const legalDocuments: Record<'privacy' | 'terms', LegalDocument | null> = {
  privacy: null,
  terms: null,
}
