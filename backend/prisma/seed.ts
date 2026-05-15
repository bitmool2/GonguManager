import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'seller@example.com' },
    update: {},
    create: {
      email: 'seller@example.com',
      passwordHash,
      name: '김셀러',
      role: 'seller',
    },
  });

  await prisma.userSetting.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      bankName: '국민은행',
      bankAccount: '123-456-789012',
      bankHolder: '김셀러',
      shippingDays: 3,
      exchangeDays: 7,
    },
  });

  // 샘플 프로젝트 생성
  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: '5월 핸드메이드 비누 공구',
      description: '천연 재료로 만든 핸드메이드 비누 공동구매',
      status: 'active',
      slug: 'kim-seller',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-31'),
    },
  });

  const products = await Promise.all([
    prisma.product.create({
      data: {
        userId: user.id,
        projectId: project.id,
        name: '핸드메이드 천연비누 세트',
        price: 25000,
        stock: 100,
        options: {
          create: [
            { optionName: '라벤더', stock: 50 },
            { optionName: '로즈마리', stock: 50 },
          ],
        },
      },
      include: { options: true },
    }),
    prisma.product.create({
      data: {
        userId: user.id,
        projectId: project.id,
        name: '유기농 그래놀라 500g',
        price: 18000,
        stock: 200,
        options: {
          create: [
            { optionName: '오리지널', stock: 100 },
            { optionName: '초코', stock: 100 },
          ],
        },
      },
      include: { options: true },
    }),
    prisma.product.create({
      data: {
        userId: user.id,
        projectId: project.id,
        name: '스테인리스 텀블러 350ml',
        price: 32000,
        stock: 80,
        options: {
          create: [
            { optionName: '실버', stock: 40 },
            { optionName: '블랙', stock: 40 },
          ],
        },
      },
      include: { options: true },
    }),
    prisma.product.create({
      data: {
        userId: user.id,
        projectId: project.id,
        name: '아로마 디퓨저 세트',
        price: 45000,
        stock: 50,
        options: {
          create: [
            { optionName: '우디', stock: 25 },
            { optionName: '플로럴', stock: 25 },
          ],
        },
      },
      include: { options: true },
    }),
    prisma.product.create({
      data: {
        userId: user.id,
        projectId: project.id,
        name: '린넨 에코백',
        price: 15000,
        stock: 150,
        options: {
          create: [
            { optionName: '아이보리', stock: 75 },
            { optionName: '네이비', stock: 75 },
          ],
        },
      },
      include: { options: true },
    }),
  ]);

  const customers = [
    { name: '박지민', phone: '010-1234-5678', address: '서울시 강남구 테헤란로 123', depositName: '박지민' },
    { name: '이수진', phone: '010-2345-6789', address: '서울시 서초구 서초대로 456', depositName: '이수진' },
    { name: '김민호', phone: '010-3456-7890', address: '서울시 마포구 월드컵북로 789', depositName: '김민호' },
    { name: '최유진', phone: '010-4567-8901', address: '경기도 성남시 분당구 정자동 12', depositName: '최유진' },
    { name: '정하늘', phone: '010-5678-9012', address: '인천시 연수구 송도동 34', depositName: '정하늘' },
    { name: '한서윤', phone: '010-6789-0123', address: '서울시 종로구 종로3가 56', depositName: '한서윤' },
    { name: '윤채원', phone: '010-7890-1234', address: '서울시 용산구 이태원로 78', depositName: '윤채원' },
    { name: '강도현', phone: '010-8901-2345', address: '경기도 고양시 일산동구 90', depositName: '강도현' },
    { name: '송예린', phone: '010-9012-3456', address: '서울시 송파구 올림픽로 11', depositName: '송예린' },
    { name: '임재훈', phone: '010-0123-4567', address: '서울시 영등포구 여의도동 22', depositName: '임재훈' },
    { name: '오다은', phone: '010-1111-2222', address: '부산시 해운대구 해운대로 33', depositName: '오다은' },
    { name: '배준서', phone: '010-2222-3333', address: '대전시 유성구 대학로 44', depositName: '배준서' },
    { name: '신아름', phone: '010-3333-4444', address: '광주시 서구 상무대로 55', depositName: '신아름' },
    { name: '조민석', phone: '010-4444-5555', address: '대구시 수성구 범어로 66', depositName: '조민석' },
    { name: '문소희', phone: '010-5555-6666', address: '울산시 남구 삼산로 77', depositName: '문소희' },
    { name: '류태양', phone: '010-6666-7777', address: '제주시 연동 88', depositName: '류태양' },
    { name: '권하영', phone: '010-7777-8888', address: '경기도 수원시 영통구 99', depositName: '권하영' },
    { name: '장민지', phone: '010-8888-9999', address: '서울시 동작구 상도동 10', depositName: '장민지' },
    { name: '황지호', phone: '010-9999-0000', address: '서울시 관악구 신림동 20', depositName: '황지호' },
    { name: '노유나', phone: '010-1010-2020', address: '서울시 성북구 성북로 30', depositName: '노유나' },
  ];

  const statuses = ['pending', 'paid', 'preparing', 'shipping', 'completed', 'canceled'];
  const paymentStatuses = ['pending', 'matched', 'mismatch'];
  const shipmentStatuses = ['pending', 'shipping', 'completed'];

  for (let i = 0; i < 20; i++) {
    const customer = customers[i];
    const product = products[i % products.length];
    const option = product.options[i % product.options.length];
    const quantity = (i % 3) + 1;
    const totalPrice = product.price * quantity;
    const orderStatus = statuses[i % statuses.length];
    const dateOffset = 20 - i;
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - dateOffset);

    const orderNumber = `GM-${orderDate.toISOString().slice(0, 10).replace(/-/g, '')}-${(i + 1).toString().padStart(4, '0')}`;

    await prisma.order.create({
      data: {
        orderNumber,
        userId: user.id,
        projectId: project.id,
        customerName: customer.name,
        phone: customer.phone,
        address: customer.address,
        totalPrice,
        depositName: customer.depositName,
        status: orderStatus,
        createdAt: orderDate,
        items: {
          create: [
            {
              productId: product.id,
              optionId: option.id,
              quantity,
              price: totalPrice,
            },
          ],
        },
        payment: {
          create: {
            depositorName: i < 10 ? customer.depositName : null,
            amount: totalPrice,
            status: i < 10 ? 'matched' : paymentStatuses[i % paymentStatuses.length],
            paidAt: i < 10 ? orderDate : null,
          },
        },
        shipment: {
          create: {
            courier: i < 10 ? ['CJ대한통운', '한진택배', '롯데택배', '우체국택배'][i % 4] : null,
            trackingNumber: i < 10 ? `${(1000000000 + i * 111111).toString()}` : null,
            status: i < 10 ? shipmentStatuses[i % shipmentStatuses.length] : 'pending',
            shippedAt: i < 10 ? orderDate : null,
          },
        },
      },
    });
  }

  await prisma.faq.createMany({
    data: [
      { userId: user.id, question: '배송은 얼마나 걸리나요?', answer: '주문 확인 후 3-5일 내 배송됩니다.' },
      { userId: user.id, question: '교환/환불은 어떻게 하나요?', answer: '수령 후 7일 이내 교환/환불 가능합니다. 고객센터로 연락해주세요.' },
      { userId: user.id, question: '입금 확인은 언제 되나요?', answer: '입금 후 1-2시간 내 확인됩니다. 영업시간 외에는 다음 영업일에 확인됩니다.' },
    ],
  });

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
