/**
 * Supporting context for the Archive page of each beat (the lede under the event's title).
 *
 * The storyboard's own title and one-line description stay exactly as written; these paragraphs
 * only add well-documented facts (dates, signatories, results, places). Contested figures, such as
 * casualty and displacement counts, are left out on purpose. Beats without an entry keep showing
 * their description. An event that already has a `detail` of its own keeps it.
 *
 * Review: added 4 Oct 2026; the data owner should confirm before publication, like IN POWER.
 */
export const EVENT_DETAILS: Record<string, string> = {
  E01: 'The Indian Independence Act, passed by the British Parliament in July 1947, created the two dominions of Pakistan and India. Pakistan marks its independence on 14 August; Muhammad Ali Jinnah was sworn in as its first Governor-General on 15 August 1947, and Karachi became the first capital.',
  E02: 'Partition set off one of the largest migrations in history, as people crossed the new borders in both directions, above all in the Punjab and Bengal. Refugee relief and resettlement had to be organised at the same time as a new government, civil service and treasury were built in Karachi.',
  E09: 'Warsak Dam, on the Kabul River near Peshawar, was built with Canadian assistance under the Colombo Plan and completed in 1960.',
  E21: "Tarbela's main dam on the Indus was completed in 1974 under the Indus Basin Project. It is one of the largest earth-filled dams in the world and became a major source of Pakistan's hydroelectric power.",
  E44: 'Projects in this phase included coal, hydropower and wind power plants, motorway sections, the Khunjerab–Rawalpindi fibre-optic cable, works at Gwadar port and the Orange Line in Lahore.',
  E48: "Laid along the Karakoram Highway under CPEC, the cable gave Pakistan its first direct overland fibre-optic link with China.",
  E50: "Pakistan confirmed its first COVID-19 cases in February 2020. A National Command and Operation Centre coordinated the response, and the national vaccination campaign began in February 2021.",
  E51: 'Record monsoon rains from June 2022 flooded large parts of Sindh and Balochistan. An international conference in Geneva in January 2023, co-hosted by Pakistan and the United Nations, gathered pledges for recovery and reconstruction.',
  E54: 'Built with a Chinese grant under CPEC, New Gwadar International Airport was inaugurated in October 2024.',
  E03: 'Muhammad Ali Jinnah spent his last weeks at Ziarat in Baluchistan and died in Karachi on 11 September 1948, thirteen months after independence. He is buried in Karachi, where the Mazar-e-Quaid now stands.',
  E04: 'Moved in the Constituent Assembly by Prime Minister Liaquat Ali Khan and adopted on 12 March 1949, the Resolution set out the principles on which the constitution was to be framed. It prefaced each of the later constitutions and in 1985 became a substantive part of the 1973 Constitution as Article 2A.',
  E05: 'Liaquat Ali Khan was shot while addressing a public meeting at Company Bagh, Rawalpindi, on 16 October 1951. The park was later renamed Liaquat Bagh in his memory.',
  E06: 'Adopted by the second Constituent Assembly on 29 February 1956 and in force from 23 March 1956, the Constitution declared Pakistan an Islamic Republic with a parliamentary system. Iskander Mirza became the first President. It was abrogated in October 1958.',
  E07: 'On 7 October 1958 President Iskander Mirza abrogated the 1956 Constitution, dismissed the government of Prime Minister Feroz Khan Noon and declared martial law, with General Muhammad Ayub Khan as Chief Martial Law Administrator. On 27 October Ayub Khan removed Mirza and assumed the presidency.',
  E08: 'Signed in Karachi on 19 September 1960 by President Ayub Khan and Prime Minister Jawaharlal Nehru, with the World Bank as a third signatory. The treaty gave Pakistan the use of the western rivers (Indus, Jhelum and Chenab) and India the eastern rivers (Ravi, Beas and Sutlej).',
  E10: 'The Space and Upper Atmosphere Research Committee (SUPARCO) was set up in 1961 on the initiative of Abdus Salam. On 7 June 1962 Rehbar-I was launched from Sonmiani on the Makran coast.',
  E11: 'Promulgated by President Ayub Khan on 1 March 1962 and in force from 8 June 1962, when martial law ended, the Constitution introduced a presidential system in which the President was elected indirectly through the Basic Democrats.',
  E12: 'Mangla Dam, on the Jhelum River, was built under the Indus Basin Project that followed the Indus Waters Treaty, to store water for irrigation and generate electricity.',
  E13: 'Fighting that began in Kashmir in August 1965 became open war across the international border on 6 September, the date Pakistan marks as Defence Day. A United Nations ceasefire took effect on 23 September, and the Tashkent Declaration followed in January 1966.',
  E14: 'Completed in 1967 on the Jhelum River, Mangla was the first of the two great storage dams of the Indus Basin Project.',
  E15: 'Tarbela Dam, on the Indus, was the second great storage dam of the Indus Basin Project. It is one of the largest earth-filled dams in the world.',
  E16: "Held on 7 December 1970 under President Yahya Khan's Legal Framework Order, it was the first general election on adult franchise. The Awami League of Sheikh Mujibur Rahman won 160 of East Pakistan's 162 seats and a majority in the National Assembly; the Pakistan Peoples Party of Zulfikar Ali Bhutto won the most seats in West Pakistan.",
  E17: 'Pakistan beat Spain 1–0 in the final of the first Hockey World Cup in Barcelona.',
  E18: 'On 16 December 1971 Lieutenant-General A. A. K. Niazi signed the Instrument of Surrender in Dhaka, ending the war in the east. East Pakistan became the independent state of Bangladesh.',
  E19: 'Signed at Simla on 2 July 1972 by President Zulfikar Ali Bhutto and Prime Minister Indira Gandhi. The two countries undertook to settle their differences bilaterally, and the ceasefire line of 17 December 1971 in Jammu and Kashmir became the Line of Control.',
  E20: 'Passed by the National Assembly on 10 April 1973 and in force from 14 August 1973, the Constitution established a federal parliamentary system. Zulfikar Ali Bhutto became Prime Minister and Fazal Ilahi Chaudhry President.',
  E22: 'After weeks of protest over the disputed elections of March 1977, the army under General Muhammad Zia-ul-Haq removed the government of Zulfikar Ali Bhutto on 5 July 1977 and imposed martial law.',
  E23: 'Built jointly by Pakistan and China across the Karakoram, the highway runs from Hasan Abdal through the Indus and Hunza valleys to the Khunjerab Pass on the Chinese border, and on to Kashgar.',
  E24: 'Pakistan beat the Netherlands 3–2 in the final in Buenos Aires.',
  E25: 'Abdus Salam shared the 1979 Nobel Prize in Physics with Sheldon Glashow and Steven Weinberg for the theory unifying the weak and electromagnetic interactions. In 1964 he had founded the International Centre for Theoretical Physics in Trieste.',
  E26: 'Pakistan Steel Mills was built with Soviet technical assistance at Bin Qasim, near Karachi.',
  E27: 'Pakistan beat West Germany 3–1 in the final in Bombay.',
  E28: 'Pakistan beat West Germany 2–1 after extra time in the Los Angeles final. Its earlier Olympic golds came in Rome (1960) and Mexico City (1968).',
  E29: 'Martial law ended on 30 December 1985, after the non-party elections of February 1985 and the Eighth Amendment to the Constitution. Muhammad Khan Junejo had been Prime Minister since March 1985.',
  E30: 'President Zia-ul-Haq was killed with senior army officers and the United States ambassador, Arnold Raphel, when his C-130 aircraft crashed near Bahawalpur on 17 August 1988.',
  E31: 'After the general election of November 1988, Benazir Bhutto, leader of the Pakistan Peoples Party, was sworn in on 2 December 1988, the first woman to lead a government in a Muslim-majority country.',
  E32: 'Muhammad Nawaz Sharif became Prime Minister on 6 November 1990 after the October 1990 election, at the head of the Islami Jamhoori Ittehad alliance.',
  E33: 'Led by Imran Khan, Pakistan beat England by 22 runs in the final at the Melbourne Cricket Ground on 25 March 1992.',
  E34: 'Pakistan won the World Cup in Sydney, beating the Netherlands on penalty strokes in the final, and the Champions Trophy in Lahore in the same year.',
  E35: "The M-2 between Lahore and Islamabad, Pakistan's first motorway, opened in November 1997.",
  E36: 'Pakistan conducted five nuclear tests in the Ras Koh Hills of Chagai on 28 May 1998 and a sixth on 30 May, a little over two weeks after India\'s tests of 11 and 13 May.',
  E37: 'A magnitude 7.6 earthquake struck on the morning of 8 October 2005, with its epicentre near Muzaffarabad. Azad Jammu and Kashmir and the North-West Frontier Province (now Khyber Pakhtunkhwa) were hit hardest.',
  E38: 'Benazir Bhutto was killed in a gun and bomb attack as she left an election rally at Liaquat Bagh, Rawalpindi, on 27 December 2007, the same park where Liaquat Ali Khan had been assassinated in 1951.',
  E39: 'Facing impeachment by the coalition government elected in February 2008, President Pervez Musharraf resigned on 18 August 2008.',
  E40: 'Signed into law by President Asif Ali Zardari on 19 April 2010, the Eighteenth Amendment devolved many subjects to the provinces, abolished the concurrent legislative list, removed the President\'s power to dissolve the National Assembly and renamed the North-West Frontier Province Khyber Pakhtunkhwa.',
  E42: 'The China-Pakistan Economic Corridor was proposed in 2013, and its first major agreements were signed during President Xi Jinping\'s visit to Islamabad in April 2015.',
  E43: 'On 16 December 2014 militants attacked the Army Public School in Peshawar, killing more than 140 people, most of them children. The attack led to the National Action Plan against terrorism.',
  E45: 'Abdul Sattar Edhi founded the Edhi Foundation, which grew into one of the largest volunteer ambulance services in the world. He died in Karachi on 8 July 2016 and was given a state funeral.',
  E47: 'After the general election of 25 July 2018, Imran Khan, chairman of Pakistan Tehreek-e-Insaf, was sworn in as Prime Minister on 18 August 2018.',
  E49: "Lahore's Orange Line, Pakistan's first metro rail line, runs from Ali Town to Dera Gujran with 26 stations. It opened on 25 October 2020.",
  E53: "Arshad Nadeem won the men's javelin at the Paris Olympics with an Olympic record of 92.97 m: Pakistan's first individual Olympic gold medal, and its first Olympic gold since 1984.",
}
