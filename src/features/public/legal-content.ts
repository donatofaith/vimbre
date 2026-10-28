// Insert the client's approved documents here. Empty documents are never
// presented as policies and never create footer links.
export type LegalDocument = { title: string; updated: string; sections: { heading: string; paragraphs: string[] }[] }
export const legalDocuments: Record<'privacy' | 'terms', LegalDocument | null> = {
  privacy: null,
  terms: {
    title: 'Stars and competition terms',
    updated: '27 October 2026',
    sections: [
      {heading:'Purpose and limits',paragraphs:['Stars recognise selected activity recorded in Vimbre. They are not a performance score and should not be used in employee reviews, pay decisions or ratings. They do not measure the quality, difficulty or full value of someone’s work.']},
      {heading:'Your choice and visibility',paragraphs:['Competition is off until a company administrator enables it. Each person separately chooses whether to appear. Individual rankings are limited to opted-in people in the same team. Private task titles, conversations and decision content are not shown in rankings. You can hide yourself in Settings.']},
      {heading:'What is measured',paragraphs:['Eligible dated tasks must exist for at least ten minutes before completion. Task credit is weighted by priority and estimated time. Approved cover tasks earn double credit. The daily cap is 15 stars. Undo removes an award, and completing the same task again earns no additional credit. Splitting work into smaller tasks must not be used to increase credit.']},
      {heading:'Responsible use',paragraphs:['Companies should explain the measurements and audience to their people. Stars must not disadvantage people who do slow, difficult or less visible work. Leave and absence must not be treated as poor performance.']},
    ],
  },
}

