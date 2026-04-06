export type CampaignStatus = 'pending' | 'approved' | 'rejected';

export interface Campaign {
  id: string;
  title: string;
  description: string;
  image: string;
  target: number;
  raised: number;
  donors: number;
  daysLeft: number;
  organizer: string;
  category: string;
  status: CampaignStatus;
  whatsappNumber: string;
}

export const campaigns: Campaign[] = [
  {
    id: '1',
    title: 'Help John Cover Hospital Bills',
    description: 'John was involved in a serious accident and needs urgent surgery. Every contribution counts towards saving his life. The family is asking for support from the community to help cover medical expenses at Kenyatta National Hospital.',
    image: 'https://images.unsplash.com/photo-1584515933487-779824d29309?w=600&h=400&fit=crop',
    target: 500000,
    raised: 347000,
    donors: 234,
    daysLeft: 12,
    organizer: 'Mary Wanjiku',
    category: 'Medical',
    status: 'approved',
    whatsappNumber: '254712345678',
  },
  {
    id: '2',
    title: 'School Fees for Bright Students',
    description: 'Help 15 bright students from Kibera continue their education. These students have shown exceptional academic performance but lack the financial support to stay in school.',
    image: 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?w=600&h=400&fit=crop',
    target: 300000,
    raised: 89000,
    donors: 67,
    daysLeft: 30,
    organizer: 'Peter Ochieng',
    category: 'Education',
    status: 'approved',
    whatsappNumber: '254723456789',
  },
  {
    id: '3',
    title: 'Community Water Project - Turkana',
    description: 'Building a borehole to provide clean water to over 2,000 people in Turkana County. Clean water will reduce waterborne diseases and improve quality of life.',
    image: 'https://images.unsplash.com/photo-1594398901394-4e34939a02eb?w=600&h=400&fit=crop',
    target: 1200000,
    raised: 780000,
    donors: 412,
    daysLeft: 45,
    organizer: 'Turkana Water Initiative',
    category: 'Community',
    status: 'approved',
    whatsappNumber: '254734567890',
  },
  {
    id: '4',
    title: 'Funeral Support for Mama Akinyi',
    description: 'Mama Akinyi served the community for over 30 years as a teacher. Help her family give her a dignified send-off.',
    image: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=600&h=400&fit=crop',
    target: 200000,
    raised: 156000,
    donors: 189,
    daysLeft: 5,
    organizer: 'David Omondi',
    category: 'Emergency',
    status: 'approved',
    whatsappNumber: '254745678901',
  },
  {
    id: '5',
    title: 'Build a Library in Garissa',
    description: 'A community library project to give children in Garissa access to books and digital learning resources.',
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=600&h=400&fit=crop',
    target: 800000,
    raised: 0,
    donors: 0,
    daysLeft: 60,
    organizer: 'Amina Hassan',
    category: 'Education',
    status: 'pending',
    whatsappNumber: '254756789012',
  },
];
