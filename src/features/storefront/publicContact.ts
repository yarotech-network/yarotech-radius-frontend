export const publicContact = {
  email: 'info@yarotech.com.ng',
  phone: '+2347075373603',
  phoneDisplay: '+234 707 537 3603',
  address: 'No. 122, Lukoro Plaza A, Kano, Nigeria',
  /**
   * Official Yarotech social profiles. Leave a value empty until the account exists —
   * only configured profiles are shown, so the site never links to a generic homepage.
   */
  social: {
    facebook: '',
    x: '',
    instagram: '',
    linkedin: '',
    youtube: '',
  },
} as const;

export type SocialNetwork = keyof typeof publicContact.social;
