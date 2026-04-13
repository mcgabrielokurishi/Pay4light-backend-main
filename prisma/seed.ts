import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const discos = [
    {
      name: 'Ikeja Electric',
      code: 'IKEDC',
      state: ['Lagos'],
      tariffRate: 68.26,
      supportPhone: '07080601000',
      supportEmail: 'customercare@ikejaelectric.com',
      website: 'https://ikejaelectric.com',
    },
    {
      name: 'Eko Electricity Distribution Company',
      code: 'EKEDC',
      state: ['Lagos'],
      tariffRate: 66.50,
      supportPhone: '07080306090',
      supportEmail: 'customerservice@ekedp.com',
      website: 'https://ekedp.com',
    },
    {
      name: 'Abuja Electricity Distribution Company',
      code: 'AEDC',
      state: ['Abuja', 'Niger', 'Nassarawa', 'Kogi'],
      tariffRate: 62.00,
      supportPhone: '07044800000',
      supportEmail: 'info@abujaelectricity.com',
      website: 'https://abujaelectricity.com',
    },
    {
      name: 'Kano Electricity Distribution Company',
      code: 'KEDCO',
      state: ['Kano', 'Katsina', 'Jigawa'],
      tariffRate: 58.00,
      supportPhone: '08039586700',
      supportEmail: 'info@kedco.ng',
      website: 'https://kedco.ng',
    },
    {
      name: 'Port Harcourt Electricity Distribution Company',
      code: 'PHEDC',
      state: ['Rivers', 'Bayelsa', 'Cross River', 'Akwa Ibom'],
      tariffRate: 63.50,
      supportPhone: '08039005678',
      supportEmail: 'customerservice@phed.com.ng',
      website: 'https://phed.com.ng',
    },
    {
      name: 'Enugu Electricity Distribution Company',
      code: 'EEDC',
      state: ['Enugu', 'Anambra', 'Imo', 'Abia', 'Ebonyi'],
      tariffRate: 60.00,
      supportPhone: '08002333333',
      supportEmail: 'customercare@enugudisco.com',
      website: 'https://enugudisco.com',
    },
    {
      name: 'Ibadan Electricity Distribution Company',
      code: 'IBEDC',
      state: ['Oyo', 'Ogun', 'Osun', 'Kwara'],
      tariffRate: 61.00,
      supportPhone: '07001234567',
      supportEmail: 'support@ibedc.com',
      website: 'https://ibedc.com',
    },
    {
      name: 'Benin Electricity Distribution Company',
      code: 'BEDC',
      state: ['Edo', 'Delta', 'Ekiti', 'Ondo'],
      tariffRate: 59.50,
      supportPhone: '08075000000',
      supportEmail: 'customercare@bedcpower.com',
      website: 'https://bedcpower.com',
    },
    {
      name: 'Jos Electricity Distribution Company',
      code: 'JEDC',
      state: ['Plateau', 'Benue', 'Gombe', 'Bauchi'],
      tariffRate: 57.00,
      supportPhone: '08038000000',
      supportEmail: 'info@jedplc.com',
      website: 'https://jedplc.com',
    },
    {
      name: 'Kaduna Electricity Distribution Company',
      code: 'KAEDCO',
      state: ['Kaduna', 'Sokoto', 'Kebbi', 'Zamfara'],
      tariffRate: 56.50,
      supportPhone: '08050000000',
      supportEmail: 'info@kaedco.com.ng',
      website: 'https://kaedco.com.ng',
    },
    {
      name: 'Yola Electricity Distribution Company',
      code: 'YEDC',
      state: ['Adamawa', 'Taraba', 'Borno', 'Yobe'],
      tariffRate: 55.00,
      supportPhone: '08036000000',
      supportEmail: 'info@yolaelectric.com',
      website: 'https://yolaelectric.com',
    },
  ];

  for (const disco of discos) {
    const discoPayload = {
      name: disco.name,
      code: disco.code,
      tariffRate: disco.tariffRate,
      supportPhone: disco.supportPhone,
      supportEmail: disco.supportEmail,
      website: disco.website,
      states: disco.state.join(', '), // Prisma requires `states` as string
    };

    await prisma.disco.upsert({
      where: { code: disco.code },
      update: discoPayload,
      create: discoPayload,
    });
  }

  console.log(' All 11 DISCOs seeded successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());