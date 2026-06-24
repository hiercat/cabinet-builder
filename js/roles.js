const CABINET_ROLES = [
  // Only fields that are consumed by the UI are kept here.
  {
    role: "Chancellor of the Duchy of Lancaster",
    cardTitle: "Chancellor of the Duchy of Lancaster",
    description: "A minister without portfolio who can support the prime minister's objectives.",
    row: 1,
    col: 4,
    raised: false
  },
  {
    role: "Prime Minister",
    cardTitle: "Prime minister",
    description: "The leader of the government.",
    row: 1,
    col: 5,
    raised: true
  },
  {
    role: "Deputy Prime Minister",
    cardTitle: "Deputy prime minister",
    description: "Supports and deputises for the prime minister.",
    row: 1,
    col: 6,
    raised: false
  },
  {
    role: "Secretary of State for Health and Social Care",
    cardTitle: "Health and social care",
    description: "Responsible for the NHS, public health, adult social care and mental health policy.",
    row: 2,
    col: 1,
    raised: false
  },
  {
    role: "Chief Whip",
    cardTitle: "Chief whip",
    description: "Manages government business and discipline in the House of Commons.",
    row: 2,
    col: 2,
    raised: false
  },
  {
    role: "Leader of the House of Commons",
    cardTitle: "Leader of the House of Commons",
    description: "Leads government business and represents the government in the House of Commons.",
    row: 2,
    col: 3,
    raised: false
  },
  {
    role: "Foreign Secretary",
    cardTitle: "Foreign secretary",
    description: "Leads UK foreign, commonwealth and development affairs including the diplomatic service.",
    row: 2,
    col: 4,
    raised: false
  },
  {
    role: "Chancellor of the Exchequer",
    cardTitle: "Chancellor of the Exchequer",
    description: "Responsible for the UK's taxation, spending and overall economic and financial policy.",
    row: 2,
    col: 5,
    raised: false
  },
  {
    role: "Home Secretary",
    cardTitle: "Home secretary",
    description: "Responsible for crime, policing, immigration and national security.",
    row: 2,
    col: 6,
    raised: false
  },
  {
    role: "Leader of the House of Lords",
    cardTitle: "Leader of the House of Lords",
    description: "Leads government business and represents the government in the House of Lords.",
    row: 2,
    col: 7,
    raised: false
  },
  {
    role: "Minister without portfolio",
    cardTitle: "Minister without portfolio",
    description: "A minister without a specific departmental responsibility, often the party chair.",
    row: 2,
    col: 8,
    raised: false
  },
  {
    role: "Secretary of State for Education",
    cardTitle: "Education",
    description: "Responsible for schools, children's services, skills and higher education.",
    row: 2,
    col: 9,
    raised: false
  },
  {
    role: "Secretary of State for Energy Security and Net Zero",
    cardTitle: "Energy security and net zero",
    description: "Responsible for energy policy and climate change mitigation.",
    row: 3,
    col: 1,
    raised: false
  },
  {
    role: "Secretary of State for Defence",
    cardTitle: "Defence",
    description: "Responsible for the armed forces, defence procurement and veterans.",
    row: 3,
    col: 2,
    raised: false
  },
  {
    role: "Secretary of State for Housing, Communities and Local Government",
    cardTitle: "Housing and communities",
    description: "Responsible for housing, planning, local government and devolution in England.",
    row: 3,
    col: 3,
    raised: false
  },
  {
    role: "Secretary of State for Northern Ireland",
    cardTitle: "Northern Ireland secretary",
    description: "Responsible for representing Northern Irish interests in Cabinet and overseeing the devolution settlement.",
    row: 3,
    col: 4,
    raised: false
  },
  {
    role: "Secretary of State for Scotland",
    cardTitle: "Scotland secretary",
    description: "Responsible for representing Scottish interests in Cabinet and overseeing the devolution settlement.",
    row: 3,
    col: 5,
    raised: false
  },
  {
    role: "Secretary of State for Wales",
    cardTitle: "Wales secretary",
    description: "Responsible for representing Welsh interests in Cabinet and overseeing the devolution settlement.",
    row: 3,
    col: 6,
    raised: false
  },
  {
    role: "Secretary of State for Justice",
    cardTitle: "Justice",
    description: "Responsible for the courts, legal aid, prisons, probation and the rule of law.",
    row: 3,
    col: 7,
    raised: false
  },
  {
    role: "Attorney General",
    cardTitle: "Attorney general",
    description: "Chief legal adviser to the government; oversees the Crown Prosecution Service and Serious Fraud Office.",
    row: 3,
    col: 8,
    raised: false
  },
  {
    role: "Secretary of State for Environment, Food and Rural Affairs",
    cardTitle: "Environment, food and rural affairs",
    description: "Responsible for farming, food standards, environmental protection and rural communities.",
    row: 3,
    col: 9,
    raised: false
  },
  {
    role: "Minister for International Development",
    cardTitle: "International development",
    description: "Leads UK policy on overseas aid, international development and humanitarian assistance.",
    row: 4,
    col: 1,
    raised: false
  },
  {
    role: "Secretary of State for Culture, Media and Sport",
    cardTitle: "Culture, media and sport",
    description: "Responsible for arts, culture, broadcasting, sport, tourism and the creative industries.",
    row: 4,
    col: 2,
    raised: false
  },
  {
    role: "Secretary of State for Science, Innovation and Technology",
    cardTitle: "Science and technology",
    description: "Responsible for research funding, innovation, AI policy, digital infrastructure and the tech sector.",
    row: 4,
    col: 3,
    raised: false
  },
  {
    role: "Secretary of State for Work and Pensions",
    cardTitle: "Work and pensions",
    description: "Responsible for welfare, pensions, employment support and labour market policy.",
    row: 4,
    col: 4,
    raised: false
  },
  {
    role: "Chief Secretary to the Treasury",
    cardTitle: "Chief secretary to the Treasury",
    description: "Responsible for day-to-day management of public spending and supporting the Chancellor.",
    row: 4,
    col: 5,
    raised: false
  },
  {
    role: "Secretary of State for Transport",
    cardTitle: "Transport",
    description: "Responsible for roads, rail, aviation, maritime transport and infrastructure investment.",
    row: 4,
    col: 6,
    raised: false
  },
  {
    role: "Secretary of State for Business and Trade",
    cardTitle: "Business and trade",
    description: "Responsible for trade policy, business regulation, investment and industrial strategy.",
    row: 4,
    col: 7,
    raised: false
  },
  {
    role: "Minister for Women and Equalities",
    cardTitle: "Women and equalities",
    description: "Responsible for equalities legislation, women's policy and reducing inequality.",
    row: 4,
    col: 8,
    raised: false
  },
  {
    role: "Minister for the Cabinet Office",
    cardTitle: "Minister for the Cabinet Office",
    description: "Responsible for the work of the Cabinet Office supporting the prime minister.",
    row: 4,
    col: 9,
    raised: false
  }
];

export { CABINET_ROLES };