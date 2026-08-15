/**
 * Comprehensive job role templates for bulk candidate generation
 * 50+ job types across multiple industries and experience levels
 */

export interface JobRoleTemplate {
    title: string;
    category: 'Engineering' | 'Product' | 'Design' | 'Data' | 'Marketing' | 'Sales' | 'HR' | 'Finance' | 'Operations' | 'Executive';
    skills: string[];
    experienceRange: [number, number]; // [min, max] years
    educationLevels: string[];
    industries: string[];
    locations: string[];
}

export const JOB_ROLE_TEMPLATES: JobRoleTemplate[] = [
    // ===== ENGINEERING (15 roles) =====
    {
        title: 'Frontend Engineer',
        category: 'Engineering',
        skills: ['React', 'TypeScript', 'JavaScript', 'CSS', 'HTML', 'Redux', 'Next.js', 'Tailwind', 'Vue', 'Angular'],
        experienceRange: [1, 8],
        educationLevels: ['Bachelor\'s in Computer Science', 'Bachelor\'s in Software Engineering', 'Bootcamp Graduate'],
        industries: ['SaaS', 'E-commerce', 'Fintech', 'Social Media', 'Gaming'],
        locations: ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'Remote']
    },
    {
        title: 'Backend Engineer',
        category: 'Engineering',
        skills: ['Node.js', 'Python', 'Go', 'Java', 'PostgreSQL', 'MongoDB', 'Redis', 'Microservices', 'REST APIs', 'GraphQL'],
        experienceRange: [2, 10],
        educationLevels: ['Bachelor\'s in Computer Science', 'Master\'s in Software Engineering'],
        industries: ['SaaS', 'Fintech', 'Healthcare', 'Cloud Infrastructure', 'E-commerce'],
        locations: ['San Francisco, CA', 'Seattle, WA', 'Boston, MA', 'Denver, CO', 'Remote']
    },
    {
        title: 'Full Stack Engineer',
        category: 'Engineering',
        skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS', 'Docker', 'Git', 'REST APIs', 'MongoDB', 'Redis'],
        experienceRange: [2, 10],
        educationLevels: ['Bachelor\'s in Computer Science', 'Self-taught', 'Bootcamp Graduate'],
        industries: ['Startups', 'SaaS', 'E-commerce', 'Fintech', 'Healthcare'],
        locations: ['San Francisco, CA', 'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Remote']
    },
    {
        title: 'DevOps Engineer',
        category: 'Engineering',
        skills: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD', 'Jenkins', 'Python', 'Bash', 'Monitoring', 'Linux'],
        experienceRange: [3, 12],
        educationLevels: ['Bachelor\'s in Computer Science', 'Bachelor\'s in Information Systems'],
        industries: ['Cloud Infrastructure', 'SaaS', 'Fintech', 'E-commerce', 'Gaming'],
        locations: ['Seattle, WA', 'San Francisco, CA', 'Austin, TX', 'Remote', 'New York, NY']
    },
    {
        title: 'Mobile Engineer',
        category: 'Engineering',
        skills: ['React Native', 'Swift', 'Kotlin', 'iOS', 'Android', 'Firebase', 'Redux', 'TypeScript', 'XCode', 'Android Studio'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Computer Science', 'Bachelor\'s in Mobile Development'],
        industries: ['Social Media', 'E-commerce', 'Fintech', 'Gaming', 'Healthcare'],
        locations: ['San Francisco, CA', 'New York, NY', 'Los Angeles, CA', 'Remote', 'Austin, TX']
    },
    {
        title: 'Data Engineer',
        category: 'Engineering',
        skills: ['Python', 'SQL', 'Spark', 'Airflow', 'ETL', 'AWS', 'Snowflake', 'Kafka', 'Data Pipelines', 'Scala'],
        experienceRange: [2, 10],
        educationLevels: ['Bachelor\'s in Computer Science', 'Master\'s in Data Engineering', 'Bachelor\'s in Mathematics'],
        industries: ['Data Analytics', 'Fintech', 'Healthcare', 'E-commerce', 'SaaS'],
        locations: ['San Francisco, CA', 'Seattle, WA', 'New York, NY', 'Remote', 'Boston, MA']
    },
    {
        title: 'Machine Learning Engineer',
        category: 'Engineering',
        skills: ['Python', 'TensorFlow', 'PyTorch', 'ML', 'Deep Learning', 'NLP', 'Computer Vision', 'AWS', 'Docker', 'Kubernetes'],
        experienceRange: [3, 12],
        educationLevels: ['Master\'s in Machine Learning', 'PhD in Computer Science', 'Bachelor\'s in AI'],
        industries: ['AI/ML', 'Autonomous Vehicles', 'Healthcare', 'Fintech', 'Robotics'],
        locations: ['San Francisco, CA', 'Seattle, WA', 'Boston, MA', 'New York, NY', 'Remote']
    },
    {
        title: 'Security Engineer',
        category: 'Engineering',
        skills: ['Cybersecurity', 'Penetration Testing', 'SIEM', 'Firewall', 'Encryption', 'Python', 'Network Security', 'Compliance', 'IAM', 'Cloud Security'],
        experienceRange: [3, 15],
        educationLevels: ['Bachelor\'s in Cybersecurity', 'Master\'s in Information Security', 'CISSP Certified'],
        industries: ['Fintech', 'Healthcare', 'Government', 'Cloud Infrastructure', 'SaaS'],
        locations: ['Washington, DC', 'San Francisco, CA', 'New York, NY', 'Austin, TX', 'Remote']
    },
    {
        title: 'QA Engineer',
        category: 'Engineering',
        skills: ['Test Automation', 'Selenium', 'Jest', 'Cypress', 'Python', 'Java', 'Manual Testing', 'API Testing', 'Performance Testing', 'CI/CD'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Computer Science', 'Bachelor\'s in Software Testing'],
        industries: ['SaaS', 'E-commerce', 'Fintech', 'Healthcare', 'Gaming'],
        locations: ['San Francisco, CA', 'Austin, TX', 'Remote', 'Seattle, WA', 'Boston, MA']
    },
    {
        title: 'Site Reliability Engineer',
        category: 'Engineering',
        skills: ['Kubernetes', 'AWS', 'Monitoring', 'Incident Response', 'Python', 'Go', 'Terraform', 'CI/CD', 'Prometheus', 'Grafana'],
        experienceRange: [4, 12],
        educationLevels: ['Bachelor\'s in Computer Science', 'Master\'s in Software Engineering'],
        industries: ['Cloud Infrastructure', 'SaaS', 'E-commerce', 'Fintech', 'Social Media'],
        locations: ['Seattle, WA', 'San Francisco, CA', 'New York, NY', 'Remote', 'Austin, TX']
    },
    {
        title: 'Cloud Architect',
        category: 'Engineering',
        skills: ['AWS', 'Azure', 'GCP', 'Cloud Architecture', 'Terraform', 'Kubernetes', 'Microservices', 'Serverless', 'Security', 'Cost Optimization'],
        experienceRange: [7, 20],
        educationLevels: ['Bachelor\'s in Computer Science', 'Master\'s in Cloud Computing', 'AWS Certified Solutions Architect'],
        industries: ['Cloud Infrastructure', 'SaaS', 'Fintech', 'Enterprise', 'Consulting'],
        locations: ['San Francisco, CA', 'Seattle, WA', 'New York, NY', 'Remote', 'Chicago, IL']
    },
    {
        title: 'Embedded Systems Engineer',
        category: 'Engineering',
        skills: ['C', 'C++', 'Embedded Systems', 'RTOS', 'Firmware', 'Hardware', 'IoT', 'Linux', 'Python', 'ARM'],
        experienceRange: [3, 15],
        educationLevels: ['Bachelor\'s in Electrical Engineering', 'Master\'s in Computer Engineering'],
        industries: ['IoT', 'Automotive', 'Robotics', 'Consumer Electronics', 'Aerospace'],
        locations: ['San Francisco, CA', 'Austin, TX', 'Boston, MA', 'Seattle, WA', 'San Diego, CA']
    },
    {
        title: 'Platform Engineer',
        category: 'Engineering',
        skills: ['Kubernetes', 'Docker', 'CI/CD', 'Infrastructure as Code', 'Python', 'Go', 'AWS', 'GitOps', 'Monitoring', 'API Design'],
        experienceRange: [4, 12],
        educationLevels: ['Bachelor\'s in Computer Science', 'Bachelor\'s in Software Engineering'],
        industries: ['SaaS', 'Cloud Infrastructure', 'Fintech', 'E-commerce', 'Developer Tools'],
        locations: ['San Francisco, CA', 'Seattle, WA', 'Remote', 'New York, NY', 'Austin, TX']
    },
    {
        title: 'Solutions Architect',
        category: 'Engineering',
        skills: ['Solution Design', 'AWS', 'System Architecture', 'Client Engagement', 'Technical Leadership', 'Cloud', 'APIs', 'Integration', 'Security', 'Scalability'],
        experienceRange: [6, 18],
        educationLevels: ['Bachelor\'s in Computer Science', 'Master\'s in Software Engineering', 'MBA'],
        industries: ['Enterprise Software', 'Consulting', 'SaaS', 'Cloud Infrastructure', 'Fintech'],
        locations: ['San Francisco, CA', 'New York, NY', 'Chicago, IL', 'Remote', 'Boston, MA']
    },
    {
        title: 'AI Research Scientist',
        category: 'Engineering',
        skills: ['Machine Learning', 'Deep Learning', 'Research', 'Python', 'TensorFlow', 'PyTorch', 'NLP', 'Computer Vision', 'Publications', 'Math'],
        experienceRange: [2, 15],
        educationLevels: ['PhD in Computer Science', 'PhD in Machine Learning', 'Master\'s in AI'],
        industries: ['AI/ML', 'Research Labs', 'Tech Giants', 'Autonomous Vehicles', 'Healthcare'],
        locations: ['San Francisco, CA', 'Seattle, WA', 'Boston, MA', 'New York, NY', 'Pittsburgh, PA']
    },

    // ===== DATA & ANALYTICS (8 roles) =====
    {
        title: 'Data Scientist',
        category: 'Data',
        skills: ['Python', 'R', 'Machine Learning', 'SQL', 'Statistics', 'Data Visualization', 'Pandas', 'Scikit-learn', 'Tableau', 'A/B Testing'],
        experienceRange: [2, 10],
        educationLevels: ['Master\'s in Data Science', 'PhD in Statistics', 'Bachelor\'s in Mathematics'],
        industries: ['Tech', 'Fintech', 'Healthcare', 'E-commerce', 'Consulting'],
        locations: ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Remote', 'Boston, MA']
    },
    {
        title: 'Data Analyst',
        category: 'Data',
        skills: ['SQL', 'Excel', 'Tableau', 'Python', 'Data Visualization', 'Statistics', 'PowerBI', 'Google Analytics', 'Reporting', 'ETL'],
        experienceRange: [1, 6],
        educationLevels: ['Bachelor\'s in Data Analytics', 'Bachelor\'s in Business', 'Bachelor\'s in Statistics'],
        industries: ['E-commerce', 'Marketing', 'Fintech', 'Healthcare', 'Retail'],
        locations: ['New York, NY', 'San Francisco, CA', 'Chicago, IL', 'Remote', 'Austin, TX']
    },
    {
        title: 'Business Intelligence Analyst',
        category: 'Data',
        skills: ['SQL', 'Tableau', 'PowerBI', 'Data Modeling', 'ETL', 'Business Analysis', 'Reporting', 'Excel', 'Data Warehousing', 'KPIs'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Business Analytics', 'Bachelor\'s in Information Systems', 'MBA'],
        industries: ['Enterprise', 'Consulting', 'Fintech', 'Healthcare', 'Retail'],
        locations: ['New York, NY', 'Chicago, IL', 'San Francisco, CA', 'Remote', 'Dallas, TX']
    },
    {
        title: 'Analytics Engineer',
        category: 'Data',
        skills: ['SQL', 'dbt', 'Python', 'Data Modeling', 'Data Warehousing', 'ETL', 'Snowflake', 'Airflow', 'Git', 'Data Quality'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Computer Science', 'Bachelor\'s in Data Science'],
        industries: ['SaaS', 'E-commerce', 'Fintech', 'Data Analytics', 'Marketing'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Seattle, WA', 'Austin, TX']
    },
    {
        title: 'Quantitative Analyst',
        category: 'Data',
        skills: ['Python', 'R', 'Statistics', 'Financial Modeling', 'Risk Analysis', 'Machine Learning', 'SQL', 'C++', 'Mathematics', 'Derivatives'],
        experienceRange: [3, 12],
        educationLevels: ['Master\'s in Financial Engineering', 'PhD in Mathematics', 'Master\'s in Quantitative Finance'],
        industries: ['Fintech', 'Investment Banking', 'Hedge Funds', 'Trading', 'Insurance'],
        locations: ['New York, NY', 'Chicago, IL', 'San Francisco, CA', 'Boston, MA', 'London, UK']
    },
    {
        title: 'ML Ops Engineer',
        category: 'Data',
        skills: ['MLOps', 'Kubernetes', 'Docker', 'Python', 'ML Deployment', 'CI/CD', 'AWS', 'Model Monitoring', 'Feature Stores', 'MLflow'],
        experienceRange: [3, 10],
        educationLevels: ['Bachelor\'s in Computer Science', 'Master\'s in Machine Learning'],
        industries: ['AI/ML', 'SaaS', 'Fintech', 'Healthcare', 'Autonomous Vehicles'],
        locations: ['San Francisco, CA', 'Seattle, WA', 'New York, NY', 'Remote', 'Boston, MA']
    },
    {
        title: 'Data Visualization Engineer',
        category: 'Data',
        skills: ['D3.js', 'JavaScript', 'Tableau', 'Python', 'Data Visualization', 'UI/UX', 'SQL', 'React', 'Design', 'Storytelling'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Data Science', 'Bachelor\'s in Design', 'Bachelor\'s in Computer Science'],
        industries: ['Data Analytics', 'SaaS', 'Consulting', 'Media', 'Marketing'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Seattle, WA', 'Austin, TX']
    },
    {
        title: 'Research Analyst',
        category: 'Data',
        skills: ['Research', 'Data Analysis', 'Statistics', 'Excel', 'SQL', 'Report Writing', 'Market Research', 'Surveys', 'Python', 'Tableau'],
        experienceRange: [1, 6],
        educationLevels: ['Bachelor\'s in Economics', 'Bachelor\'s in Social Sciences', 'Master\'s in Research'],
        industries: ['Consulting', 'Market Research', 'Healthcare', 'Government', 'Academia'],
        locations: ['New York, NY', 'Washington, DC', 'Boston, MA', 'Remote', 'Chicago, IL']
    },

    // ===== PRODUCT (6 roles) =====
    {
        title: 'Product Manager',
        category: 'Product',
        skills: ['Product Strategy', 'Roadmap Planning', 'User Research', 'Agile', 'Stakeholder Management', 'Data Analysis', 'A/B Testing', 'Jira', 'Figma', 'SQL'],
        experienceRange: [3, 12],
        educationLevels: ['Bachelor\'s in Business', 'Bachelor\'s in Computer Science', 'MBA'],
        industries: ['SaaS', 'E-commerce', 'Fintech', 'Social Media', 'Enterprise'],
        locations: ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Remote', 'Los Angeles, CA']
    },
    {
        title: 'Technical Product Manager',
        category: 'Product',
        skills: ['Product Management', 'Technical Architecture', 'API Design', 'SQL', 'Data Analysis', 'Engineering Background', 'Agile', 'Roadmap', 'Stakeholder Management', 'Analytics'],
        experienceRange: [4, 12],
        educationLevels: ['Bachelor\'s in Computer Science', 'Master\'s in Engineering', 'MBA'],
        industries: ['SaaS', 'Developer Tools', 'Platform', 'Cloud Infrastructure', 'Fintech'],
        locations: ['San Francisco, CA', 'Seattle, WA', 'New York, NY', 'Remote', 'Austin, TX']
    },
    {
        title: 'Product Designer',
        category: 'Design',
        skills: ['UI/UX Design', 'Figma', 'User Research', 'Prototyping', 'Design Systems', 'Interaction Design', 'Wireframing', 'User Testing', 'Adobe Creative Suite', 'HTML/CSS'],
        experienceRange: [2, 10],
        educationLevels: ['Bachelor\'s in Design', 'Bachelor\'s in HCI', 'Self-taught'],
        industries: ['SaaS', 'E-commerce', 'Social Media', 'Fintech', 'Gaming'],
        locations: ['San Francisco, CA', 'New York, NY', 'Los Angeles, CA', 'Remote', 'Seattle, WA']
    },
    {
        title: 'UX Researcher',
        category: 'Design',
        skills: ['User Research', 'Usability Testing', 'Qualitative Research', 'Quantitative Research', 'Surveys', 'Interviews', 'Data Analysis', 'Psychology', 'Figma', 'Reporting'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Psychology', 'Master\'s in HCI', 'Bachelor\'s in Cognitive Science'],
        industries: ['SaaS', 'E-commerce', 'Social Media', 'Healthcare', 'Fintech'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Seattle, WA', 'Austin, TX']
    },
    {
        title: 'Growth Product Manager',
        category: 'Product',
        skills: ['Growth Strategy', 'A/B Testing', 'Analytics', 'User Acquisition', 'Retention', 'Product Analytics', 'SQL', 'Experimentation', 'Funnel Optimization', 'Data-Driven'],
        experienceRange: [3, 10],
        educationLevels: ['Bachelor\'s in Business', 'Bachelor\'s in Marketing', 'MBA'],
        industries: ['SaaS', 'E-commerce', 'Social Media', 'Mobile Apps', 'Marketplaces'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Los Angeles, CA', 'Seattle, WA']
    },
    {
        title: 'Product Operations Manager',
        category: 'Product',
        skills: ['Product Operations', 'Process Improvement', 'Data Analysis', 'Project Management', 'Stakeholder Management', 'Agile', 'Metrics', 'Automation', 'Documentation', 'Strategy'],
        experienceRange: [3, 10],
        educationLevels: ['Bachelor\'s in Business', 'Bachelor\'s in Operations', 'MBA'],
        industries: ['SaaS', 'E-commerce', 'Fintech', 'Enterprise', 'Platform'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Seattle, WA', 'Austin, TX']
    },

    // ===== DESIGN (4 roles) =====
    {
        title: 'UI Designer',
        category: 'Design',
        skills: ['UI Design', 'Figma', 'Sketch', 'Adobe XD', 'Design Systems', 'Visual Design', 'Prototyping', 'Typography', 'Color Theory', 'Branding'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Design', 'Bachelor\'s in Visual Arts', 'Self-taught'],
        industries: ['SaaS', 'E-commerce', 'Marketing', 'Agencies', 'Gaming'],
        locations: ['San Francisco, CA', 'New York, NY', 'Los Angeles, CA', 'Remote', 'Austin, TX']
    },
    {
        title: 'UX Designer',
        category: 'Design',
        skills: ['UX Design', 'User Research', 'Wireframing', 'Prototyping', 'Figma', 'User Testing', 'Information Architecture', 'Interaction Design', 'Usability', 'Accessibility'],
        experienceRange: [2, 10],
        educationLevels: ['Bachelor\'s in Design', 'Master\'s in HCI', 'Bachelor\'s in Psychology'],
        industries: ['SaaS', 'E-commerce', 'Fintech', 'Healthcare', 'Social Media'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Seattle, WA', 'Austin, TX']
    },
    {
        title: 'Graphic Designer',
        category: 'Design',
        skills: ['Graphic Design', 'Adobe Creative Suite', 'Photoshop', 'Illustrator', 'InDesign', 'Branding', 'Typography', 'Print Design', 'Digital Design', 'Marketing Materials'],
        experienceRange: [2, 10],
        educationLevels: ['Bachelor\'s in Graphic Design', 'Bachelor\'s in Visual Arts', 'Self-taught'],
        industries: ['Marketing', 'Agencies', 'E-commerce', 'Media', 'Publishing'],
        locations: ['New York, NY', 'Los Angeles, CA', 'San Francisco, CA', 'Remote', 'Chicago, IL']
    },
    {
        title: 'Motion Designer',
        category: 'Design',
        skills: ['Motion Graphics', 'After Effects', 'Animation', '3D Design', 'Video Editing', 'Premiere Pro', 'Cinema 4D', 'Storytelling', 'Visual Effects', 'Creative Direction'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Motion Design', 'Bachelor\'s in Animation', 'Self-taught'],
        industries: ['Media', 'Advertising', 'Gaming', 'Entertainment', 'SaaS'],
        locations: ['Los Angeles, CA', 'New York, NY', 'San Francisco, CA', 'Remote', 'Austin, TX']
    },

    // ===== MARKETING (6 roles) =====
    {
        title: 'Digital Marketing Manager',
        category: 'Marketing',
        skills: ['Digital Marketing', 'SEO', 'SEM', 'Google Ads', 'Social Media', 'Content Marketing', 'Analytics', 'Email Marketing', 'Marketing Automation', 'Campaign Management'],
        experienceRange: [3, 10],
        educationLevels: ['Bachelor\'s in Marketing', 'Bachelor\'s in Business', 'MBA'],
        industries: ['E-commerce', 'SaaS', 'Retail', 'Agencies', 'Media'],
        locations: ['New York, NY', 'San Francisco, CA', 'Los Angeles, CA', 'Remote', 'Chicago, IL']
    },
    {
        title: 'Content Marketing Manager',
        category: 'Marketing',
        skills: ['Content Strategy', 'Copywriting', 'SEO', 'Content Creation', 'Editorial', 'Blog Management', 'Social Media', 'Analytics', 'Brand Voice', 'Storytelling'],
        experienceRange: [3, 10],
        educationLevels: ['Bachelor\'s in Marketing', 'Bachelor\'s in Communications', 'Bachelor\'s in Journalism'],
        industries: ['SaaS', 'Media', 'E-commerce', 'Agencies', 'Technology'],
        locations: ['New York, NY', 'San Francisco, CA', 'Remote', 'Austin, TX', 'Los Angeles, CA']
    },
    {
        title: 'Growth Marketing Manager',
        category: 'Marketing',
        skills: ['Growth Marketing', 'A/B Testing', 'User Acquisition', 'Conversion Optimization', 'Analytics', 'Experimentation', 'SEO', 'Paid Ads', 'Retention', 'Funnel Optimization'],
        experienceRange: [3, 10],
        educationLevels: ['Bachelor\'s in Marketing', 'Bachelor\'s in Business', 'MBA'],
        industries: ['SaaS', 'E-commerce', 'Mobile Apps', 'Marketplaces', 'Startups'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Los Angeles, CA', 'Seattle, WA']
    },
    {
        title: 'Marketing Analyst',
        category: 'Marketing',
        skills: ['Marketing Analytics', 'SQL', 'Google Analytics', 'Excel', 'Data Visualization', 'Campaign Analysis', 'A/B Testing', 'Attribution Modeling', 'Reporting', 'Tableau'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Marketing', 'Bachelor\'s in Statistics', 'Bachelor\'s in Business'],
        industries: ['E-commerce', 'SaaS', 'Retail', 'Fintech', 'Healthcare'],
        locations: ['New York, NY', 'San Francisco, CA', 'Chicago, IL', 'Remote', 'Boston, MA']
    },
    {
        title: 'Social Media Manager',
        category: 'Marketing',
        skills: ['Social Media Marketing', 'Content Creation', 'Community Management', 'Instagram', 'Twitter', 'LinkedIn', 'TikTok', 'Analytics', 'Influencer Marketing', 'Brand Voice'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Marketing', 'Bachelor\'s in Communications', 'Self-taught'],
        industries: ['E-commerce', 'Media', 'Fashion', 'Beauty', 'SaaS'],
        locations: ['Los Angeles, CA', 'New York, NY', 'San Francisco, CA', 'Remote', 'Miami, FL']
    },
    {
        title: 'SEO Specialist',
        category: 'Marketing',
        skills: ['SEO', 'Keyword Research', 'Link Building', 'Content Optimization', 'Google Analytics', 'Google Search Console', 'Technical SEO', 'Analytics', 'SEM', 'Content Strategy'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Marketing', 'Bachelor\'s in Communications', 'Self-taught'],
        industries: ['E-commerce', 'SaaS', 'Media', 'Agencies', 'Retail'],
        locations: ['Remote', 'New York, NY', 'San Francisco, CA', 'Austin, TX', 'Los Angeles, CA']
    },

    // ===== SALES (5 roles) =====
    {
        title: 'Account Executive',
        category: 'Sales',
        skills: ['Sales', 'B2B Sales', 'Salesforce', 'Negotiation', 'Lead Generation', 'Cold Calling', 'Prospecting', 'Closing', 'Relationship Building', 'CRM'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Business', 'Bachelor\'s in Marketing', 'Any Bachelor\'s'],
        industries: ['SaaS', 'Enterprise', 'Fintech', 'Healthcare', 'Technology'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Chicago, IL', 'Austin, TX']
    },
    {
        title: 'Sales Development Representative',
        category: 'Sales',
        skills: ['Lead Generation', 'Prospecting', 'Cold Calling', 'Email Outreach', 'Salesforce', 'Qualification', 'Sales Pipeline', 'CRM', 'Communication', 'Persistence'],
        experienceRange: [0, 3],
        educationLevels: ['Bachelor\'s in Business', 'Bachelor\'s in Marketing', 'Any Bachelor\'s'],
        industries: ['SaaS', 'Technology', 'Startups', 'Enterprise', 'E-commerce'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Austin, TX', 'Seattle, WA']
    },
    {
        title: 'Customer Success Manager',
        category: 'Sales',
        skills: ['Customer Success', 'Account Management', 'Relationship Building', 'Salesforce', 'Onboarding', 'Renewals', 'Upselling', 'Problem Solving', 'Communication', 'Analytics'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Business', 'Bachelor\'s in Communications', 'Any Bachelor\'s'],
        industries: ['SaaS', 'Technology', 'E-commerce', 'Fintech', 'Healthcare'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Austin, TX', 'Seattle, WA']
    },
    {
        title: 'Sales Engineer',
        category: 'Sales',
        skills: ['Technical Sales', 'Product Demos', 'Solution Design', 'Presales', 'Technical Presentations', 'API Integration', 'POC', 'Salesforce', 'Engineering Background', 'Communication'],
        experienceRange: [3, 10],
        educationLevels: ['Bachelor\'s in Computer Science', 'Bachelor\'s in Engineering', 'Bachelor\'s in Business'],
        industries: ['SaaS', 'Enterprise Software', 'Cloud Infrastructure', 'DevTools', 'Cybersecurity'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Seattle, WA', 'Boston, MA']
    },
    {
        title: 'Enterprise Account Manager',
        category: 'Sales',
        skills: ['Enterprise Sales', 'Account Management', 'Strategic Planning', 'Relationship Management', 'Negotiation', 'Salesforce', 'C-Level Engagement', 'Contract Negotiation', 'Upselling', 'Renewals'],
        experienceRange: [5, 15],
        educationLevels: ['Bachelor\'s in Business', 'MBA', 'Any Bachelor\'s'],
        industries: ['Enterprise Software', 'SaaS', 'Cloud Infrastructure', 'Consulting', 'Fintech'],
        locations: ['New York, NY', 'San Francisco, CA', 'Chicago, IL', 'Remote', 'Boston, MA']
    },

    // ===== HR & RECRUITING (4 roles) =====
    {
        title: 'Technical Recruiter',
        category: 'HR',
        skills: ['Technical Recruiting', 'Sourcing', 'LinkedIn Recruiter', 'Boolean Search', 'Interviewing', 'Candidate Experience', 'ATS', 'Employer Branding', 'Negotiation', 'Relationship Building'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in HR', 'Bachelor\'s in Business', 'Any Bachelor\'s'],
        industries: ['Technology', 'Startups', 'SaaS', 'Fintech', 'Recruiting Agencies'],
        locations: ['San Francisco, CA', 'New York, NY', 'Austin, TX', 'Remote', 'Seattle, WA']
    },
    {
        title: 'HR Business Partner',
        category: 'HR',
        skills: ['HR Strategy', 'Employee Relations', 'Performance Management', 'Talent Development', 'Change Management', 'Compensation', 'Benefits', 'Compliance', 'HRIS', 'Coaching'],
        experienceRange: [4, 12],
        educationLevels: ['Bachelor\'s in HR', 'Master\'s in HR', 'MBA'],
        industries: ['Technology', 'Healthcare', 'Fintech', 'Retail', 'Manufacturing'],
        locations: ['New York, NY', 'San Francisco, CA', 'Chicago, IL', 'Remote', 'Austin, TX']
    },
    {
        title: 'Talent Acquisition Manager',
        category: 'HR',
        skills: ['Recruiting Strategy', 'Team Leadership', 'Sourcing', 'Employer Branding', 'Diversity Hiring', 'Metrics', 'ATS', 'Stakeholder Management', 'Pipeline Management', 'Budget Management'],
        experienceRange: [5, 12],
        educationLevels: ['Bachelor\'s in HR', 'Bachelor\'s in Business', 'MBA'],
        industries: ['Technology', 'Startups', 'Enterprise', 'Healthcare', 'Consulting'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Seattle, WA', 'Austin, TX']
    },
    {
        title: 'People Operations Manager',
        category: 'HR',
        skills: ['People Operations', 'HR Systems', 'Process Improvement', 'Employee Experience', 'HRIS', 'Analytics', 'Compliance', 'Onboarding', 'Benefits Administration', 'Culture'],
        experienceRange: [3, 10],
        educationLevels: ['Bachelor\'s in HR', 'Bachelor\'s in Business', 'Master\'s in HR'],
        industries: ['Startups', 'Technology', 'SaaS', 'E-commerce', 'Healthcare'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Austin, TX', 'Los Angeles, CA']
    },

    // ===== FINANCE (4 roles) =====
    {
        title: 'Financial Analyst',
        category: 'Finance',
        skills: ['Financial Modeling', 'Excel', 'Financial Analysis', 'Forecasting', 'Budgeting', 'Reporting', 'Variance Analysis', 'PowerPoint', 'SQL', 'Accounting'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Finance', 'Bachelor\'s in Accounting', 'MBA'],
        industries: ['Fintech', 'Investment Banking', 'Corporate Finance', 'SaaS', 'Consulting'],
        locations: ['New York, NY', 'San Francisco, CA', 'Chicago, IL', 'Boston, MA', 'Remote']
    },
    {
        title: 'Accountant',
        category: 'Finance',
        skills: ['Accounting', 'Financial Reporting', 'GAAP', 'QuickBooks', 'Month-End Close', 'Reconciliation', 'Tax', 'Auditing', 'Excel', 'NetSuite'],
        experienceRange: [2, 10],
        educationLevels: ['Bachelor\'s in Accounting', 'CPA', 'Master\'s in Accounting'],
        industries: ['Accounting Firms', 'Corporate Finance', 'Fintech', 'Healthcare', 'Manufacturing'],
        locations: ['New York, NY', 'Chicago, IL', 'San Francisco, CA', 'Remote', 'Dallas, TX']
    },
    {
        title: 'FP&A Analyst',
        category: 'Finance',
        skills: ['Financial Planning', 'Forecasting', 'Budgeting', 'Excel', 'Financial Modeling', 'Variance Analysis', 'Strategic Planning', 'Reporting', 'SQL', 'Analytics'],
        experienceRange: [3, 10],
        educationLevels: ['Bachelor\'s in Finance', 'MBA', 'Bachelor\'s in Accounting'],
        industries: ['SaaS', 'Technology', 'Corporate Finance', 'Fintech', 'E-commerce'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Chicago, IL', 'Austin, TX']
    },
    {
        title: 'Controller',
        category: 'Finance',
        skills: ['Accounting Leadership', 'Financial Reporting', 'GAAP', 'Team Management', 'Audit', 'Internal Controls', 'Month-End Close', 'Compliance', 'NetSuite', 'Strategic Finance'],
        experienceRange: [7, 20],
        educationLevels: ['Bachelor\'s in Accounting', 'CPA', 'MBA'],
        industries: ['SaaS', 'Technology', 'Fintech', 'Healthcare', 'Manufacturing'],
        locations: ['San Francisco, CA', 'New York, NY', 'Remote', 'Austin, TX', 'Chicago, IL']
    },

    // ===== OPERATIONS (3 roles) =====
    {
        title: 'Operations Manager',
        category: 'Operations',
        skills: ['Operations Management', 'Process Improvement', 'Project Management', 'Analytics', 'Team Leadership', 'Vendor Management', 'Budgeting', 'Cross-Functional Collaboration', 'KPIs', 'Problem Solving'],
        experienceRange: [4, 12],
        educationLevels: ['Bachelor\'s in Business', 'Bachelor\'s in Operations', 'MBA'],
        industries: ['E-commerce', 'Logistics', 'Manufacturing', 'SaaS', 'Retail'],
        locations: ['Chicago, IL', 'New York, NY', 'San Francisco, CA', 'Remote', 'Dallas, TX']
    },
    {
        title: 'Supply Chain Analyst',
        category: 'Operations',
        skills: ['Supply Chain', 'Logistics', 'Inventory Management', 'Data Analysis', 'Excel', 'Forecasting', 'ERP', 'Process Optimization', 'Vendor Management', 'Analytics'],
        experienceRange: [2, 8],
        educationLevels: ['Bachelor\'s in Supply Chain', 'Bachelor\'s in Operations', 'Bachelor\'s in Business'],
        industries: ['E-commerce', 'Logistics', 'Manufacturing', 'Retail', 'CPG'],
        locations: ['Chicago, IL', 'Dallas, TX', 'Atlanta, GA', 'Remote', 'Seattle, WA']
    },
    {
        title: 'Program Manager',
        category: 'Operations',
        skills: ['Program Management', 'Project Management', 'Stakeholder Management', 'Agile', 'Risk Management', 'Budget Management', 'Cross-Functional Leadership', 'Communication', 'Jira', 'Strategy'],
        experienceRange: [5, 15],
        educationLevels: ['Bachelor\'s in Business', 'PMP Certified', 'MBA'],
        industries: ['Technology', 'SaaS', 'Consulting', 'Enterprise', 'Healthcare'],
        locations: ['San Francisco, CA', 'Seattle, WA', 'New York, NY', 'Remote', 'Austin, TX']
    },

    // ===== EXECUTIVE (3 roles) =====
    {
        title: 'Chief Technology Officer',
        category: 'Executive',
        skills: ['Technology Strategy', 'Leadership', 'Architecture', 'Engineering Management', 'Innovation', 'Cloud', 'Security', 'Budget Management', 'Stakeholder Management', 'Product Development'],
        experienceRange: [12, 25],
        educationLevels: ['Bachelor\'s in Computer Science', 'Master\'s in Engineering', 'MBA'],
        industries: ['Technology', 'SaaS', 'Startups', 'Fintech', 'E-commerce'],
        locations: ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Boston, MA']
    },
    {
        title: 'VP of Engineering',
        category: 'Executive',
        skills: ['Engineering Leadership', 'Team Building', 'Strategic Planning', 'Architecture', 'Hiring', 'Budget Management', 'Agile', 'Technical Excellence', 'Cross-Functional Collaboration', 'Innovation'],
        experienceRange: [10, 20],
        educationLevels: ['Bachelor\'s in Computer Science', 'Master\'s in Engineering', 'MBA'],
        industries: ['SaaS', 'Technology', 'Startups', 'Fintech', 'E-commerce'],
        locations: ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Remote', 'Austin, TX']
    },
    {
        title: 'VP of Product',
        category: 'Executive',
        skills: ['Product Strategy', 'Product Leadership', 'Roadmap Planning', 'Team Building', 'Stakeholder Management', 'Market Analysis', 'User Research', 'Data-Driven', 'Innovation', 'Go-to-Market'],
        experienceRange: [10, 20],
        educationLevels: ['Bachelor\'s in Business', 'Bachelor\'s in Computer Science', 'MBA'],
        industries: ['SaaS', 'Technology', 'E-commerce', 'Fintech', 'Social Media'],
        locations: ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Remote', 'Los Angeles, CA']
    }
];

// Helper function to get random items from array
export function getRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// Helper function to get a random item
export function getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

// First names pool
export const FIRST_NAMES = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Barbara', 'David', 'Elizabeth', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
    'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
    'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
    'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa',
    'Timothy', 'Deborah', 'Ronald', 'Stephanie', 'Edward', 'Rebecca', 'Jason', 'Sharon',
    'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy',
    'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna', 'Stephen', 'Brenda',
    'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
    'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine', 'Gregory', 'Debra',
    'Frank', 'Rachel', 'Alexander', 'Carolyn', 'Patrick', 'Janet', 'Raymond', 'Catherine',
    'Jack', 'Maria', 'Dennis', 'Heather', 'Jerry', 'Diane', 'Tyler', 'Ruth',
    'Aaron', 'Julie', 'Jose', 'Olivia', 'Adam', 'Joyce', 'Nathan', 'Virginia'
];

// Last names pool
export const LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
    'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
    'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
    'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
    'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
    'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
    'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
    'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza',
    'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers'
];

// Companies pool
export const COMPANIES = [
    'Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Netflix', 'Uber', 'Airbnb',
    'Stripe', 'Salesforce', 'Adobe', 'Oracle', 'SAP', 'IBM', 'Cisco', 'Intel',
    'NVIDIA', 'Tesla', 'SpaceX', 'Twitter', 'LinkedIn', 'Dropbox', 'Slack', 'Zoom',
    'Atlassian', 'MongoDB', 'Snowflake', 'DataBricks', 'Twilio', 'Square', 'PayPal', 'Shopify',
    'DoorDash', 'Instacart', 'Lyft', 'Reddit', 'Pinterest', 'Snap', 'TikTok', 'Discord',
    'Figma', 'Notion', 'Airtable', 'Asana', 'Monday.com', 'HubSpot', 'Zendesk', 'ServiceNow',
    'Workday', 'DocuSign', 'Okta', 'Auth0', 'HashiCorp', 'GitLab', 'GitHub', 'Vercel'
];

// Universities pool
export const UNIVERSITIES = [
    'Stanford University', 'MIT', 'Harvard University', 'UC Berkeley', 'Carnegie Mellon',
    'Georgia Tech', 'University of Washington', 'UT Austin', 'UCLA', 'USC',
    'University of Michigan', 'Cornell University', 'Columbia University', 'Princeton University', 'Yale University',
    'Cal Tech', 'Brown University', 'Northwestern University', 'Duke University', 'UPenn',
    'University of Illinois', 'Purdue University', 'University of Wisconsin', 'Ohio State University', 'Penn State',
    'NYU', 'Boston University', 'Northeastern University', 'University of Florida', 'University of Texas'
];
