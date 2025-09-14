import type { PublicArticle } from '../types/purchase';

export const mockArticles: PublicArticle[] = [
  {
    id: '1',
    slug: 'ultimate-guide-seo-best-practices-2024',
    title: 'The Ultimate Guide to SEO Best Practices in 2024',
    preview: 'Discover the latest SEO strategies and techniques that will help your website rank higher in search results. This comprehensive guide covers everything from keyword research to technical optimization.',
    availability_status: 'AVAILABLE',
    domain: 'Tech Blog',
    created_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    slug: 'digital-marketing-trends-future',
    title: 'Digital Marketing Trends That Will Shape the Future',
    preview: 'Explore the emerging digital marketing trends that businesses need to know about. From AI-powered campaigns to personalized customer experiences, learn what\'s coming next.',
    availability_status: 'SOLD_OUT',
    domain: 'Marketing Hub',
    created_at: '2024-01-10T14:30:00Z'
  },
  {
    id: '3',
    slug: 'building-high-performance-web-applications-react',
    title: 'Building High-Performance Web Applications with React',
    preview: 'Learn how to create fast, scalable web applications using React and modern development practices. This guide covers performance optimization, state management, and best practices.',
    availability_status: 'AVAILABLE',
    domain: 'Dev Central',
    created_at: '2024-01-08T09:15:00Z'
  },
  {
    id: '4',
    slug: 'complete-guide-content-marketing-strategy',
    title: 'The Complete Guide to Content Marketing Strategy',
    preview: 'Master the art of content marketing with this comprehensive guide. Learn how to create engaging content that drives traffic, generates leads, and builds brand authority.',
    availability_status: 'PROCESSING',
    domain: 'Content Pro',
    created_at: '2024-01-05T16:45:00Z'
  },
  {
    id: '5',
    slug: 'cybersecurity-best-practices-small-businesses',
    title: 'Cybersecurity Best Practices for Small Businesses',
    preview: 'Protect your business from cyber threats with these essential security practices. Learn about common vulnerabilities and how to implement effective security measures.',
    availability_status: 'AVAILABLE',
    domain: 'Security Today',
    created_at: '2024-01-03T11:20:00Z'
  },
  {
    id: '6',
    slug: 'ecommerce-optimization-converting-visitors-customers',
    title: 'E-commerce Optimization: Converting Visitors to Customers',
    preview: 'Increase your online store\'s conversion rates with proven optimization techniques. From user experience design to checkout process improvements, boost your sales today.',
    availability_status: 'AVAILABLE',
    domain: 'E-commerce Insights',
    created_at: '2024-01-01T08:00:00Z'
  }
];

export const mockArticleAvailability = {
  '1': { available: true },
  '2': { available: false, reason: 'Currently under review after recent backlink purchase' },
  '3': { available: true },
  '4': { available: false, reason: 'Processing payment from recent order' },
  '5': { available: true },
  '6': { available: true }
};