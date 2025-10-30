
import type { Job } from '../types';

export const ALL_JOBS: Job[] = [
  { 
    id: 'j1', 
    title: 'Senior Software Engineer (React)', 
    department: 'Technology', 
    location: 'Budapest, Hungary', 
    type: 'Full-time', 
    description: 'Join our dynamic tech team to build next-generation software solutions. Responsible for full software development lifecycle, from conception to deployment. Seeking a highly motivated individual with a passion for innovation. Key skills include React, Node.js, TypeScript, and AWS. Experience with microservices architecture and Agile methodologies is crucial.', 
    requiredSkills: ['React', 'Node.js', 'TypeScript', 'AWS', 'Agile', 'Microservices'], 
    postedDate: '2025-05-28', 
    status: 'open',
    companyContext: {
      industry: 'SaaS',
      companySize: '500-1000 employees',
      reportingStructure: 'Reports to Engineering Manager',
      roleContextNotes: 'At our company, "Senior" implies team mentorship and architectural input. Progression is to "Staff Engineer". We value autonomy and proactive problem-solving.'
    }
  },
  { 
    id: 'j2', 
    title: 'Marketing Manager', 
    department: 'Marketing', 
    location: 'Debrecen, Hungary', 
    type: 'Full-time', 
    description: 'Lead our marketing strategy and execution. Develop and implement innovative campaigns to drive brand awareness and customer acquisition. Strong analytical and leadership skills required. Expertise in digital marketing, SEO/SEM, content strategy, and social media marketing is essential.', 
    requiredSkills: ['Digital Marketing', 'SEO/SEM', 'Content Strategy', 'Social Media Marketing', 'Analytics'], 
    postedDate: '2025-05-25', 
    status: 'open',
    companyContext: {
      industry: 'E-commerce',
      companySize: '200-500 employees',
      reportingStructure: 'Reports to Head of Marketing',
    }
  },
  { 
    id: 'j3', 
    title: 'HR Business Partner', 
    department: 'Human Resources', 
    location: 'Budapest, Hungary', 
    type: 'Contract', 
    description: 'Partner with business leaders to provide HR guidance and support. Focus on talent management, employee relations, and organizational development. Excellent communication and interpersonal skills are a must. Knowledge of Hungarian Labor Law is a plus.', 
    requiredSkills: ['Employee Relations', 'Talent Management', 'HR Policies', 'Performance Management', 'Hungarian Labor Law'], 
    postedDate: '2025-05-20', 
    status: 'on hold',
    companyContext: {
        industry: 'Professional Services',
        companySize: '1000+ employees',
        reportingStructure: 'Reports to Senior HR Director',
        roleContextNotes: 'This role is a key strategic partner to the tech division, requiring a deep understanding of the talent challenges in that space.'
    }
  },
  {
    id: 'j4',
    title: 'Data Scientist',
    department: 'Business Intelligence',
    location: 'Budapest, Hungary (Hybrid)',
    type: 'Full-time',
    description: 'We are looking for a Data Scientist to analyze large amounts of raw information to find patterns that will help improve our company. We will rely on you to build data products to extract valuable business insights. You should be highly analytical with a knack for analysis, math and statistics.',
    requiredSkills: ['Python', 'R', 'SQL', 'Machine Learning', 'TensorFlow', 'Scikit-learn', 'Data Visualization'],
    postedDate: '2025-05-18',
    status: 'open'
  },
  {
    id: 'j5',
    title: 'Product Manager',
    department: 'Product',
    location: 'Szeged, Hungary',
    type: 'Full-time',
    description: 'As a Product Manager, you will be responsible for the product planning and execution throughout the Product Lifecycle, including: gathering and prioritizing product and customer requirements, defining the product vision, and working closely with engineering, sales, marketing and support to ensure revenue and customer satisfaction goals are met.',
    requiredSkills: ['Product Management', 'Agile Methodologies', 'Roadmapping', 'User Research', 'Jira'],
    postedDate: '2025-05-15',
    status: 'open'
  },
  {
    id: 'j6',
    title: 'Senior QA Automation Engineer',
    department: 'Technology',
    location: 'Budapest, Hungary',
    type: 'Full-time',
    description: 'Design and develop automation frameworks for our applications. You will be responsible for creating, executing and maintaining automated test scripts. Must have strong experience with Selenium or Cypress.',
    requiredSkills: ['Test Automation', 'Selenium', 'Cypress', 'JavaScript', 'CI/CD', 'API Testing'],
    postedDate: '2025-05-12',
    status: 'closed'
  },
  {
    id: 'j7',
    title: 'DevOps Engineer',
    department: 'Technology',
    location: 'Remote (Hungary)',
    type: 'Full-time',
    description: 'Join our infrastructure team to manage and improve our CI/CD pipelines, cloud infrastructure, and monitoring systems. We are an AWS-native company.',
    requiredSkills: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD', 'Linux'],
    postedDate: '2025-05-10',
    status: 'open'
  },
  {
    id: 'j8',
    title: 'UI/UX Designer',
    department: 'Product',
    location: 'Budapest, Hungary',
    type: 'Full-time',
    description: 'We are seeking a talented UI/UX Designer to create amazing user experiences. The ideal candidate should have an eye for clean and artful design, possess superior UI skills and be able to translate high-level requirements into interaction flows and artifacts, and transform them into beautiful, intuitive, and functional user interfaces.',
    requiredSkills: ['UI Design', 'UX Research', 'Figma', 'Prototyping', 'Wireframing'],
    postedDate: '2025-05-08',
    status: 'open'
  },
  {
    id: 'j9',
    title: 'Financial Controller',
    department: 'Finance',
    location: 'Pécs, Hungary',
    type: 'Full-time',
    description: 'Manage all accounting operations including Billing, A/R, A/P, GL and Counsel, Cost Accounting, Inventory Accounting and Revenue Recognition. Coordinate and direct the preparation of the budget and financial forecasts and report variances.',
    requiredSkills: ['Financial Reporting', 'Accounting', 'Budgeting', 'SAP', 'Excel'],
    postedDate: '2025-05-05',
    status: 'on hold'
  },
  {
    id: 'j10',
    title: 'Junior Backend Developer (Java)',
    department: 'Technology',
    location: 'Budapest, Hungary',
    type: 'Full-time',
    description: 'Exciting opportunity for a recent graduate or junior developer to join our backend team. You will be working with experienced engineers on our core Java-based microservices.',
    requiredSkills: ['Java', 'Spring Boot', 'SQL', 'Git', 'REST APIs'],
    postedDate: '2025-05-02',
    status: 'open'
  },
  {
    id: 'j11',
    title: 'IT Help Desk Technician',
    department: 'IT',
    location: 'Miskolc, Hungary',
    type: 'Full-time',
    description: 'Serve as the first point of contact for employees seeking technical assistance over the phone or email. Perform remote troubleshooting through diagnostic techniques and pertinent questions.',
    requiredSkills: ['Customer Service', 'Troubleshooting', 'Active Directory', 'Windows OS', 'Networking'],
    postedDate: '2025-04-30',
    status: 'open'
  },
  {
    id: 'j12',
    title: 'Content Strategist',
    department: 'Marketing',
    location: 'Remote (Hungary)',
    type: 'Full-time',
    description: 'Develop content strategies that align with marketing targets. You will be responsible for creating, improving and maintaining content to achieve our business goals.',
    requiredSkills: ['Content Strategy', 'SEO', 'Copywriting', 'Analytics', 'Content Management Systems'],
    postedDate: '2025-04-28',
    status: 'open'
  },
  {
    id: 'j13',
    title: 'Recruiter (Technical)',
    department: 'Human Resources',
    location: 'Budapest, Hungary',
    type: 'Full-time',
    description: 'Join our TA team to find and attract the best tech talent. You will be responsible for the full recruitment lifecycle for technical roles.',
    requiredSkills: ['Technical Recruiting', 'Sourcing', 'Talent Acquisition', 'Interviewing', 'LinkedIn Recruiter'],
    postedDate: '2025-04-25',
    status: 'closed'
  },
  {
    id: 'j14',
    title: 'Senior Product Designer',
    department: 'Product',
    location: 'Budapest, Hungary',
    type: 'Full-time',
    description: 'Lead design projects across the entire product lifecycle. You will set the vision for the user experience and create the space for others to collaborate. A strong portfolio of shipped products is required.',
    requiredSkills: ['Product Design', 'Figma', 'Design Systems', 'User Research', 'Leadership'],
    postedDate: '2025-04-22',
    status: 'open'
  },
  {
    id: 'j15',
    title: 'Cloud Architect (Azure)',
    department: 'Technology',
    location: 'Debrecen, Hungary',
    type: 'Full-time',
    description: 'Design and implement cloud solutions on Azure. Provide technical leadership and guidance to development teams on cloud-native best practices.',
    requiredSkills: ['Azure', 'Cloud Architecture', 'Terraform', 'Kubernetes', 'Security'],
    postedDate: '2025-04-20',
    status: 'open'
  },
  {
    id: 'j16',
    title: 'Sales Executive',
    department: 'Sales',
    location: 'Budapest, Hungary',
    type: 'Full-time',
    description: 'Responsible for the full sales cycle, from lead generation to closing. Must have a proven track record of meeting and exceeding sales targets in a B2B environment.',
    requiredSkills: ['B2B Sales', 'Negotiation', 'Salesforce', 'Lead Generation', 'Closing'],
    postedDate: '2025-04-18',
    status: 'open'
  },
  {
    id: 'j17',
    title: 'Mobile Developer (iOS)',
    department: 'Technology',
    location: 'Budapest, Hungary (Hybrid)',
    type: 'Full-time',
    description: 'We are looking for an experienced iOS developer to join our mobile team. You will be responsible for developing and maintaining our flagship iOS application.',
    requiredSkills: ['Swift', 'iOS SDK', 'Xcode', 'REST APIs', 'UIKit', 'SwiftUI'],
    postedDate: '2025-04-15',
    status: 'open'
  },
  {
    id: 'j18',
    title: 'Scrum Master',
    department: 'Technology',
    location: 'Szeged, Hungary',
    type: 'Full-time',
    description: 'Facilitate agile ceremonies and support our development teams in following the Scrum framework. Remove impediments and foster an environment of continuous improvement.',
    requiredSkills: ['Scrum', 'Agile Coaching', 'Jira', 'Facilitation', 'Servant-Leadership'],
    postedDate: '2025-04-12',
    status: 'on hold'
  },
  {
    id: 'j19',
    title: 'Business Analyst',
    department: 'Product',
    location: 'Budapest, Hungary',
    type: 'Full-time',
    description: 'Work with stakeholders to gather, analyze, and document business requirements. Translate business needs into technical specifications for the development teams.',
    requiredSkills: ['Business Analysis', 'Requirements Gathering', 'SQL', 'Agile', 'Process Mapping'],
    postedDate: '2025-04-10',
    status: 'open'
  },
  {
    id: 'j20',
    title: 'Lead Data Engineer',
    department: 'Business Intelligence',
    location: 'Remote (Hungary)',
    type: 'Full-time',
    description: 'Lead a team of data engineers to design, build, and maintain our data platform. Must have strong experience with big data technologies and team leadership.',
    requiredSkills: ['Data Engineering', 'Spark', 'Airflow', 'Python', 'SQL', 'Team Leadership', 'ETL'],
    postedDate: '2025-04-08',
    status: 'open'
  },
  {
    id: 'j21',
    title: 'Executive Assistant to CEO',
    department: 'Administration',
    location: 'Budapest, Hungary',
    type: 'Full-time',
    description: 'Provide high-level administrative support to the CEO. Manage complex calendars, coordinate travel, and handle confidential information.',
    requiredSkills: ['Executive Support', 'Calendar Management', 'Discretion', 'Communication', 'Organization'],
    postedDate: '2025-04-05',
    status: 'open'
  },
  {
    id: 'j22',
    title: 'Digital Marketing Specialist (PPC)',
    department: 'Marketing',
    location: 'Budapest, Hungary',
    type: 'Full-time',
    description: 'Manage our paid search campaigns across Google Ads and social media platforms. Optimize campaigns for performance and ROI.',
    requiredSkills: ['PPC', 'Google Ads', 'Social Media Advertising', 'Google Analytics', 'Excel'],
    postedDate: '2025-04-02',
    status: 'closed'
  },
  {
    id: 'j23',
    title: 'Full-Stack Engineer (PHP/Vue)',
    department: 'Technology',
    location: 'Pécs, Hungary',
    type: 'Full-time',
    description: 'We are looking for a versatile full-stack developer to work on our web applications. Our stack is primarily PHP (Laravel) on the backend and Vue.js on the frontend.',
    requiredSkills: ['PHP', 'Laravel', 'Vue.js', 'MySQL', 'JavaScript', 'API Development'],
    postedDate: '2025-04-01',
    status: 'open'
  }
];
