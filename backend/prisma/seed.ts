import { PrismaClient, TaskStatus, TaskPriority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding...");

  const password = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: { name: "Asha Rao", email: "admin@agency.test", passwordHash: password, role: "ADMIN" },
  });

  const pm1 = await prisma.user.create({
    data: { name: "Meera Iyer", email: "pm1@agency.test", passwordHash: password, role: "PM" },
  });
  const pm2 = await prisma.user.create({
    data: { name: "Karan Shah", email: "pm2@agency.test", passwordHash: password, role: "PM" },
  });

  const dev1 = await prisma.user.create({
    data: { name: "Ravi Kumar", email: "dev1@agency.test", passwordHash: password, role: "DEVELOPER" },
  });
  const dev2 = await prisma.user.create({
    data: { name: "Priya Nair", email: "dev2@agency.test", passwordHash: password, role: "DEVELOPER" },
  });
  const dev3 = await prisma.user.create({
    data: { name: "Sameer Joshi", email: "dev3@agency.test", passwordHash: password, role: "DEVELOPER" },
  });
  const dev4 = await prisma.user.create({
    data: { name: "Anjali Desai", email: "dev4@agency.test", passwordHash: password, role: "DEVELOPER" },
  });

  const client1 = await prisma.client.create({ data: { name: "Northwind Retail" } });
  const client2 = await prisma.client.create({ data: { name: "Bluepeak Finance" } });
  const client3 = await prisma.client.create({ data: { name: "Orchid Health" } });

  const project1 = await prisma.project.create({
    data: { name: "Website Revamp", clientId: client1.id, createdById: pm1.id, description: "Full redesign of the marketing site" },
  });
  const project2 = await prisma.project.create({
    data: { name: "Mobile App Launch", clientId: client2.id, createdById: pm1.id, description: "iOS/Android app v1" },
  });
  const project3 = await prisma.project.create({
    data: { name: "Patient Portal", clientId: client3.id, createdById: pm2.id, description: "Internal portal for scheduling" },
  });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
  const priorities: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const devs = [dev1, dev2, dev3, dev4];

  const taskDefs = [
    { project: project1, titles: ["Homepage hero redesign", "Set up CMS", "Migrate blog content", "SEO audit", "Mobile nav fix", "Analytics integration"] },
    { project: project2, titles: ["Auth flow", "Push notifications", "Onboarding screens", "App store listing", "Crash reporting setup"] },
    { project: project3, titles: ["Appointment booking UI", "Doctor availability calendar", "Patient records view", "Notification reminders", "Admin reporting dashboard"] },
  ];

  let overdueAssigned = 0;
  const createdTasks: any[] = [];

  for (const def of taskDefs) {
    for (let i = 0; i < def.titles.length; i++) {
      const isOverdueCandidate = overdueAssigned < 2 && i % 3 === 0;
      const dueOffset = isOverdueCandidate ? -3 * day : (i + 1) * 3 * day;
      const dueDate = new Date(now + dueOffset);
      const isOverdue = isOverdueCandidate;
      if (isOverdueCandidate) overdueAssigned++;

      const task = await prisma.task.create({
        data: {
          title: def.titles[i],
          description: `Work item for ${def.project.name}`,
          projectId: def.project.id,
          assignedToId: devs[i % devs.length].id,
          status: statuses[i % statuses.length],
          priority: priorities[i % priorities.length],
          dueDate,
          isOverdue,
        },
      });
      createdTasks.push(task);
    }
  }

  // Pre-existing activity log entries so the feed isn't empty on first load
  for (const task of createdTasks.slice(0, 12)) {
    await prisma.activityLog.create({
      data: {
        projectId: task.projectId,
        taskId: task.id,
        actorId: task.assignedToId ?? admin.id,
        action: "TASK_CREATED",
        message: `Task "${task.title}" was created`,
        createdAt: new Date(now - Math.random() * 5 * day),
      },
    });
  }

  console.log("Seed complete.");
  console.log("Login with any user, password: password123");
  console.log("Admin: admin@agency.test");
  console.log("PMs: pm1@agency.test, pm2@agency.test");
  console.log("Devs: dev1@agency.test .. dev4@agency.test");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
