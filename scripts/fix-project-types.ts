/**
 * Script to fix project types in the database
 * This ensures all projects have the correct projectType field set
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixProjectTypes() {
  try {
    console.log('Starting project type fix...');

    // Get all projects
    const allProjects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        projectType: true,
        createdAt: true
      }
    });

    console.log(`Found ${allProjects.length} total projects`);

    // Count projects by type
    const projectsWithNoType = allProjects.filter(p => !p.projectType);
    const studioProjects = allProjects.filter(p => p.projectType === 'studio');
    const workProjects = allProjects.filter(p => p.projectType === 'work');

    console.log(`Projects with no type: ${projectsWithNoType.length}`);
    console.log(`Studio projects: ${studioProjects.length}`);
    console.log(`Work projects: ${workProjects.length}`);

    // Fix projects with no type - set them to 'studio' as default
    if (projectsWithNoType.length > 0) {
      console.log('\nFixing projects with no type...');

      for (const project of projectsWithNoType) {
        console.log(`Setting project "${project.name}" (${project.id}) to type 'studio'`);

        await prisma.project.update({
          where: { id: project.id },
          data: { projectType: 'studio' }
        });
      }

      console.log(`Fixed ${projectsWithNoType.length} projects`);
    }

    // Display all projects after fix
    console.log('\n=== All Projects After Fix ===');
    const updatedProjects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        projectType: true
      },
      orderBy: { createdAt: 'desc' }
    });

    updatedProjects.forEach(p => {
      console.log(`- ${p.name} (${p.id}): ${p.projectType}`);
    });

    console.log('\nProject type fix completed successfully!');

  } catch (error) {
    console.error('Error fixing project types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixProjectTypes();