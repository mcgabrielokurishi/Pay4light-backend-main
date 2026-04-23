import { Injectable, NotFoundException } from '@nestjs/common';

export interface NigerianBank {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode?: string;
  ussd?: string;
}

const NIGERIAN_BANKS: NigerianBank[] = [
  { id: 1,   name: 'Access Bank',                                    slug: 'access-bank',                        code: '044',    longcode: '044150149',  ussd: '*901#' },
  { id: 3,   name: 'Access Bank (Diamond)',                          slug: 'access-bank-diamond',                code: '063',    longcode: '063150162',  ussd: '*901#' },
  { id: 4,   name: 'Ecobank Nigeria',                                slug: 'ecobank-nigeria',                    code: '050',    longcode: '050150010',  ussd: '*326#' },
  { id: 6,   name: 'Fidelity Bank',                                  slug: 'fidelity-bank',                      code: '070',    longcode: '070150003',  ussd: '*770#' },
  { id: 7,   name: 'First Bank of Nigeria',                          slug: 'first-bank-of-nigeria',              code: '011',    longcode: '011151003',  ussd: '*894#' },
  { id: 8,   name: 'First City Monument Bank',                       slug: 'first-city-monument-bank',           code: '214',    longcode: '214150018',  ussd: '*329#' },
  { id: 9,   name: 'Guaranty Trust Bank',                            slug: 'guaranty-trust-bank',                code: '058',    longcode: '058152036',  ussd: '*737#' },
  { id: 10,  name: 'Heritage Bank',                                  slug: 'heritage-bank',                      code: '030',    longcode: '030159992',  ussd: '*745#' },
  { id: 11,  name: 'Keystone Bank',                                  slug: 'keystone-bank',                      code: '082',    longcode: '082150017',  ussd: '*7111#' },
  { id: 13,  name: 'Polaris Bank',                                   slug: 'polaris-bank',                       code: '076',    longcode: '076151006',  ussd: '*833#' },
  { id: 14,  name: 'Stanbic IBTC Bank',                              slug: 'stanbic-ibtc-bank',                  code: '221',    longcode: '221159522',  ussd: '*909#' },
  { id: 15,  name: 'Standard Chartered Bank',                        slug: 'standard-chartered-bank',            code: '068',    longcode: '068150015' },
  { id: 16,  name: 'Sterling Bank',                                  slug: 'sterling-bank',                      code: '232',    longcode: '232150016',  ussd: '*822#' },
  { id: 17,  name: 'Union Bank of Nigeria',                          slug: 'union-bank-of-nigeria',              code: '032',    longcode: '032080474',  ussd: '*826#' },
  { id: 18,  name: 'United Bank For Africa',                         slug: 'united-bank-for-africa',             code: '033',    longcode: '033153513',  ussd: '*919#' },
  { id: 19,  name: 'Unity Bank',                                     slug: 'unity-bank',                         code: '215',    longcode: '215154097',  ussd: '*7799#' },
  { id: 21,  name: 'Zenith Bank',                                    slug: 'zenith-bank',                        code: '057',    longcode: '057150013',  ussd: '*966#' },
  { id: 22,  name: 'Jaiz Bank',                                      slug: 'jaiz-bank',                          code: '301',    longcode: '301080020',  ussd: '*773#' },
  { id: 23,  name: 'Suntrust Bank',                                  slug: 'suntrust-bank',                      code: '100',                            ussd: '*5230#' },
  { id: 25,  name: 'Providus Bank',                                  slug: 'providus-bank',                      code: '101' },
  { id: 26,  name: 'Parallex Bank',                                  slug: 'parallex-bank',                      code: '104',                            ussd: '*1242#' },
  { id: 64,  name: 'Ekondo Microfinance Bank',                       slug: 'ekondo-microfinance-bank-ng',        code: '098' },
  { id: 67,  name: 'Kuda Bank',                                      slug: 'kuda-bank',                          code: '50211',                          ussd: '*894#' },
  { id: 68,  name: 'TAJ Bank',                                       slug: 'taj-bank',                           code: '302',                            ussd: '*898#' },
  { id: 69,  name: 'Rubies MFB',                                     slug: 'rubies-mfb',                         code: '125',                            ussd: '*7797#' },
  { id: 70,  name: 'Globus Bank',                                    slug: 'globus-bank',                        code: '00103',  longcode: '103015001',  ussd: '*989#' },
  { id: 71,  name: 'VFD Microfinance Bank Limited',                  slug: 'vfd',                                code: '566',                            ussd: '*5037#' },
  { id: 72,  name: 'Sparkle Microfinance Bank',                      slug: 'sparkle-microfinance-bank',          code: '51310' },
  { id: 74,  name: 'CEMCS Microfinance Bank',                        slug: 'cemcs-microfinance-bank',            code: '50823' },
  { id: 75,  name: 'TCF MFB',                                        slug: 'tcf-mfb',                            code: '51211' },
  { id: 81,  name: 'Hasal Microfinance Bank',                        slug: 'hasal-microfinance-bank',            code: '50383' },
  { id: 82,  name: 'Carbon',                                         slug: 'carbon',                             code: '565' },
  { id: 108, name: 'Bowen Microfinance Bank',                        slug: 'bowen-microfinance-bank',            code: '50931' },
  { id: 109, name: 'Lagos Building Investment Company Plc.',         slug: 'lbic-plc',                           code: '90052' },
  { id: 110, name: 'Parkway - ReadyCash',                            slug: 'parkway-ready-cash',                 code: '311' },
  { id: 167, name: 'Eyowo',                                          slug: 'eyowo',                              code: '50126',                          ussd: '*4255#' },
  { id: 168, name: 'Ibile Microfinance Bank',                        slug: 'ibile-mfb',                          code: '51244' },
  { id: 172, name: 'Infinity MFB',                                   slug: 'infinity-mfb',                       code: '50457' },
  { id: 173, name: 'Coronation Merchant Bank',                       slug: 'coronation-merchant-bank-ng',        code: '559' },
  { id: 174, name: 'Abbey Mortgage Bank',                            slug: 'abbey-mortgage-bank',                code: '801',                            ussd: '*332#' },
  { id: 176, name: 'Rand Merchant Bank',                             slug: 'rand-merchant-bank',                 code: '502' },
  { id: 177, name: 'Firmus MFB',                                     slug: 'firmus-mfb',                         code: '51314' },
  { id: 178, name: 'Mint MFB',                                       slug: 'mint-mfb',                           code: '50304' },
  { id: 179, name: 'Amju Unique MFB',                                slug: 'amju-unique-mfb',                    code: '50926' },
  { id: 180, name: 'Links MFB',                                      slug: 'links-mfb',                          code: '50549' },
  { id: 181, name: 'Bainescredit MFB',                               slug: 'bainescredit-mfb',                   code: '51229' },
  { id: 183, name: 'GoMoney',                                        slug: 'gomoney',                            code: '100022' },
  { id: 184, name: 'Kredi Money MFB LTD',                            slug: 'kredi-money-mfb',                    code: '50200' },
  { id: 186, name: 'Tangerine Money',                                slug: 'tangerine-money',                    code: '51269' },
  { id: 187, name: 'Kadpoly MFB',                                    slug: 'kadpoly-mfb',                        code: '50502' },
  { id: 188, name: 'Above Only MFB',                                 slug: 'above-only-mfb',                     code: '51204' },
  { id: 232, name: 'QuickFund MFB',                                  slug: 'quickfund-mfb',                      code: '51293' },
  { id: 233, name: 'Lotus Bank',                                     slug: 'lotus-bank',                         code: '303',                            ussd: '*5045#' },
  { id: 282, name: 'Unical MFB',                                     slug: 'unical-mfb',                         code: '50871' },
  { id: 283, name: 'Corestep MFB',                                   slug: 'corestep-mfb',                       code: '50204' },
  { id: 284, name: 'Chanelle Microfinance Bank Limited',             slug: 'chanelle-microfinance-bank-limited-ng', code: '50171' },
  { id: 285, name: 'Stellas MFB',                                    slug: 'stellas-mfb',                        code: '51253' },
  { id: 286, name: 'Safe Haven MFB',                                 slug: 'safe-haven-mfb-ng',                  code: '51113' },
  { id: 287, name: 'Gateway Mortgage Bank LTD',                      slug: 'gateway-mortgage-bank',              code: '812' },
  { id: 295, name: 'Refuge Mortgage Bank',                           slug: 'refuge-mortgage-bank',               code: '90067' },
  { id: 296, name: 'Living Trust Mortgage Bank',                     slug: 'living-trust-mortgage-bank',         code: '031',                            ussd: '*723*312#' },
  { id: 297, name: 'Astrapolaris MFB LTD',                           slug: 'astrapolaris-mfb',                   code: 'MFB50094' },
  { id: 300, name: 'Airtel Smartcash PSB',                           slug: 'airtel-smartcash-psb-ng',            code: '120004',  longcode: '120004' },
  { id: 301, name: 'HopePSB',                                        slug: 'hopepsb-ng',                         code: '120002',  longcode: '120002' },
  { id: 302, name: '9mobile 9Payment Service Bank',                  slug: '9mobile-9payment-service-bank-ng',   code: '120001',  longcode: '120001',  ussd: '*990#' },
  { id: 303, name: 'MTN Momo PSB',                                   slug: 'mtn-momo-psb-ng',                    code: '120003',  longcode: '120003',  ussd: '*671#' },
  { id: 304, name: 'PremiumTrust Bank',                              slug: 'premiumtrust-bank-ng',               code: '105',     longcode: '000031',  ussd: '*858#' },
  { id: 365, name: 'Solid Rock MFB',                                 slug: 'solid-rock-mfb',                     code: '50800' },
  { id: 495, name: 'Accion Microfinance Bank',                       slug: 'accion-microfinance-bank-ng',        code: '602',                            ussd: '*572#' },
  { id: 609, name: 'Safe Haven Microfinance Bank Limited',           slug: 'safe-haven-microfinance-bank-limited-ng', code: '951113' },
  { id: 614, name: 'Aramoko MFB',                                    slug: 'aramoko-mfb',                        code: '50083' },
  { id: 615, name: 'Ikoyi Osun MFB',                                 slug: 'ikoyi-osun-mfb',                     code: '50439' },
  { id: 626, name: 'Polyunwana MFB',                                 slug: 'polyunwana-mfb-ng',                  code: '50864' },
  { id: 627, name: 'Abulesoro MFB',                                  slug: 'abulesoro-mfb-ng',                   code: '51312' },
  { id: 628, name: 'Ekimogun MFB',                                   slug: 'ekimogun-mfb-ng',                    code: '50263' },
  { id: 629, name: 'Titan Paystack',                                  slug: 'titan-paystack',                     code: '100039' },
  { id: 630, name: 'Uhuru MFB',                                      slug: 'uhuru-mfb-ng',                       code: 'MFB51322' },
  { id: 632, name: 'Shield MFB',                                     slug: 'shield-mfb-ng',                      code: '50582' },
  { id: 635, name: 'Goodnews Microfinance Bank',                     slug: 'goodnews-microfinance-bank-ng',       code: '50739' },
  { id: 636, name: 'Ilaro Poly Microfinance Bank',                   slug: 'ilaro-poly-microfinance-bank-ng',    code: '50442' },
  { id: 637, name: 'Dot Microfinance Bank',                          slug: 'dot-microfinance-bank-ng',           code: '50162' },
  { id: 638, name: 'Unilag Microfinance Bank',                       slug: 'unilag-microfinance-bank-ng',        code: '51316' },
  { id: 679, name: 'Rockshield Microfinance Bank',                   slug: 'rockshield-microfinance-bank-ng',    code: '50767' },
  { id: 682, name: 'FirstTrust Mortgage Bank Nigeria',               slug: 'firsttrust-mortgage-bank-nigeria-ng', code: '413' },
  { id: 687, name: 'Flourish MFB',                                   slug: 'flourish-mfb-ng',                    code: '50315' },
  { id: 688, name: 'Moniepoint MFB',                                 slug: 'moniepoint-mfb-ng',                  code: '50515',                          ussd: '*888#' },
  { id: 689, name: 'Ampersand Microfinance Bank',                    slug: 'ampersand-microfinance-bank-ng',     code: '51341' },
  { id: 690, name: 'U&C Microfinance Bank Ltd',                      slug: 'uc-microfinance-bank-ltd-u-and-c-mfb-ng', code: '50840' },
  { id: 691, name: 'Consumer Microfinance Bank',                     slug: 'consumer-microfinance-bank-ng',      code: '50910' },
  { id: 692, name: 'Cashconnect MFB',                                slug: 'cashconnect-mfb-ng',                 code: '865' },
  { id: 693, name: 'Peace Microfinance Bank',                        slug: 'peace-microfinance-bank-ng',         code: '50743' },
  { id: 695, name: 'Solid Allianze MFB',                             slug: 'solid-allianze-mfb',                 code: '51062' },
  { id: 697, name: 'Branch International Financial Services',        slug: 'branch',                             code: 'FC40163' },
  { id: 699, name: 'Optimus Bank Limited',                           slug: 'optimus-bank-ltd',                   code: '107',     longcode: '00107',   ussd: '*930#' },
  { id: 701, name: 'Waya Microfinance Bank',                         slug: 'waya-microfinance-bank-ng',          code: '51355' },
  { id: 703, name: 'Imowo MFB',                                      slug: 'imowo-mfb-ng',                       code: '50453' },
  { id: 704, name: 'Chikum Microfinance Bank',                       slug: 'chikum-microfinance-bank-ng',        code: '312' },
  { id: 705, name: 'Platinum Mortgage Bank',                         slug: 'platinum-mortgage-bank-ng',          code: '268' },
  { id: 706, name: 'Sage Grey Finance Limited',                      slug: 'sage-grey-finance-limited-ng',       code: '40165' },
  { id: 707, name: 'Amegy Microfinance Bank',                        slug: 'amegy-microfinance-bank-ng',         code: '090629' },
];

@Injectable()
export class BankService {

  // GET ALL BANKS
  getAllBanks(search?: string) {
    let banks = NIGERIAN_BANKS;

    if (search) {
      const query = search.toLowerCase();
      banks = banks.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.code.toLowerCase().includes(query) ||
          b.slug.toLowerCase().includes(query),
      );
    }

    return banks.sort((a, b) => a.name.localeCompare(b.name));
  }

  // GET BANK BY CODE
  getBankByCode(code: string) {
    const bank = NIGERIAN_BANKS.find(
      (b) => b.code.toLowerCase() === code.toLowerCase(),
    );

    if (!bank) {
      throw new NotFoundException(`Bank with code "${code}" not found`);
    }

    return bank;
  }

  // GET BANK BY SLUG
  getBankBySlug(slug: string) {
    const bank = NIGERIAN_BANKS.find((b) => b.slug === slug.toLowerCase());

    if (!bank) {
      throw new NotFoundException(`Bank "${slug}" not found`);
    }

    return bank;
  }
}