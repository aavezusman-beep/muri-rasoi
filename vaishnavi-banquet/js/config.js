/* ==========================================================
   VAISHNAVI BANQUET — SITE CONFIGURATION
   Edit values here. Leave a value empty ('') if you don't have it yet;
   the site then hides that feature instead of showing made-up data.
   Never put a Supabase "service_role" key here. Only the anon key.
   ========================================================== */
window.VB_CONFIG = {
  VENUE_NAME: 'Vaishnavi Banquet',
  RESTAURANT_NAME: 'VR Vaishnavi Restaurant',
  TAGLINE: 'Celebrations in Silli, Ranchi, with VR Vaishnavi Restaurant',
  ADDRESS: 'Main Road, Silli, Ranchi, Jharkhand',
  PHONES: ['9334192001', '7004780657'],          // shown as click-to-call
  ENQUIRY_WHATSAPP: '919334192001',              // country code + number; OWNER TO CONFIRM which number receives enquiries
  EMAIL: '',                                     // add if the venue has one
  MAP_QUERY: 'Vaishnavi Banquet, Main Road, Silli, Ranchi, Jharkhand', // replace with an exact Google Maps place name/link if the pin is wrong
  GOOGLE_BUSINESS_URL: '',                       // venue's verified Google Business Profile / Maps link
  GOOGLE_REVIEW_URL: '',                         // link that opens the venue's Google review form
  INSTAGRAM_URL: '',                             // leave empty unless the venue's Instagram is verified
  FACILITIES: [                                  // only list what the venue confirms it offers
    'Wheelchair-accessible entrance, exit and parking',
    'Associated restaurant: VR Vaishnavi Restaurant'
  ],
  SUPABASE_URL: '',                              // e.g. https://xxxx.supabase.co
  SUPABASE_ANON_KEY: '',                         // public anon key from Supabase > Project Settings > API

  // Shown ONLY when the database is empty or not connected. Clearly labelled as samples.
  SAMPLE_PACKAGES: [
    { name: '[Sample package — replace]', description: 'Owner to add real package details.', price_type: 'enquiry', price: null, guest_limit: null, inclusions: [], exclusions: [], featured: false },
  ],
  SAMPLE_MENU: [
    { category: 'Starters', name: 'Paneer Tikka (sample)', description: 'Sample dish. Replace with the restaurant\'s real menu.', is_veg: true, price: null, available: true },
    { category: 'Starters', name: 'Chicken Tikka (sample)', description: 'Sample dish. Replace with the restaurant\'s real menu.', is_veg: false, price: null, available: true },
    { category: 'Starters', name: 'Vegetable Pakora (sample)', description: 'Sample dish. Replace with the restaurant\'s real menu.', is_veg: true, price: null, available: true },
    { category: 'Main course', name: 'Paneer Butter Masala (sample)', description: 'Sample dish. Replace with the restaurant\'s real menu.', is_veg: true, price: null, available: true },
    { category: 'Main course', name: 'Dal Tadka (sample)', description: 'Sample dish. Replace with the restaurant\'s real menu.', is_veg: true, price: null, available: true },
    { category: 'Main course', name: 'Chicken Curry (sample)', description: 'Sample dish. Replace with the restaurant\'s real menu.', is_veg: false, price: null, available: false },
    { category: 'Breads & rice', name: 'Butter Naan (sample)', description: 'Sample dish. Replace with the restaurant\'s real menu.', is_veg: true, price: null, available: true },
    { category: 'Breads & rice', name: 'Vegetable Biryani (sample)', description: 'Sample dish. Replace with the restaurant\'s real menu.', is_veg: true, price: null, available: true },
    { category: 'Desserts', name: 'Gulab Jamun (sample)', description: 'Sample dish. Replace with the restaurant\'s real menu.', is_veg: true, price: null, available: true },
  ],
  SAMPLE_GALLERY: [
    { url: 'assets/images/entrance-evening.webp', caption: 'Venue entrance (evening)', category: 'Exterior' },
    { url: 'assets/images/entrance-day.webp', caption: 'Venue entrance (daytime)', category: 'Exterior' },
    { url: 'assets/images/entrance-night.webp', caption: 'Venue entrance (night)', category: 'Exterior' },
    { url: 'assets/images/stage.webp', caption: 'Decorated stage', category: 'Stage' },
    { url: 'assets/images/stage-2.webp', caption: 'Decorated stage with arch', category: 'Stage' },
    { url: 'assets/images/decor-birthday-arch.webp', caption: 'Birthday balloon decoration', category: 'Decoration' },
    { url: 'assets/images/food-court.webp', caption: 'Food court area', category: 'Dining' },
  ],
  FAQS: [
    { q: 'What is the maximum guest capacity?', a: 'Capacity is not yet confirmed on this site. Please contact the venue for details.' },
    { q: 'How can I check availability?', a: 'Use the Availability calendar on the Book page. Green dates are open, amber dates have a pending enquiry, and grey dates are unavailable.' },
    { q: 'How do I book the venue?', a: 'Send a booking enquiry from the Book page. An enquiry is not a confirmed booking until the venue confirms it.' },
    { q: 'Is catering included?', a: 'This depends on the package you choose. Please ask the venue for the current inclusions.' },
    { q: 'Is parking available?', a: 'Yes, the venue has wheelchair-accessible parking. Please ask the venue for the details.' },
    { q: 'What is the cancellation policy?', a: 'See the Cancellation & Refund Policy on the Policies page. The owner should review it before publishing.' },
  ],
  DESIGNER: { name: 'Aavez Usman', phone: '917004898475', instagram: 'https://www.instagram.com/aavez_usman/' }
};
