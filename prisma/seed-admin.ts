import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAdminData() {
  console.log('🌱 Seeding admin system data...');

  try {
    // 1. Create System Permissions
    console.log('Creating system permissions...');
    const permissions = [
      // System Administration
      { resource: 'admin', action: 'system', description: 'Full system administration access' },
      { resource: 'admin', action: 'users', description: 'Manage users and their roles' },
      { resource: 'admin', action: 'analytics', description: 'View and manage analytics data' },
      { resource: 'admin', action: 'logs', description: 'View and manage system logs' },
      { resource: 'admin', action: 'settings', description: 'Manage system settings' },

      // User Management
      { resource: 'user', action: 'create', description: 'Create new users' },
      { resource: 'user', action: 'read', description: 'View user information' },
      { resource: 'user', action: 'update', description: 'Update user information' },
      { resource: 'user', action: 'delete', description: 'Delete users' },
      { resource: 'user', action: 'manage_roles', description: 'Assign and remove user roles' },

      // Project Management
      { resource: 'project', action: 'create', description: 'Create new projects' },
      { resource: 'project', action: 'read', description: 'View project information' },
      { resource: 'project', action: 'update', description: 'Update project information' },
      { resource: 'project', action: 'delete', description: 'Delete projects' },
      { resource: 'project', action: 'manage', description: 'Full project management access' },

      // Content Management
      { resource: 'scene', action: 'create', description: 'Create new scenes' },
      { resource: 'scene', action: 'read', description: 'View scene information' },
      { resource: 'scene', action: 'update', description: 'Update scene information' },
      { resource: 'scene', action: 'delete', description: 'Delete scenes' },

      { resource: 'image', action: 'create', description: 'Upload new images' },
      { resource: 'image', action: 'read', description: 'View images' },
      { resource: 'image', action: 'update', description: 'Update image information' },
      { resource: 'image', action: 'delete', description: 'Delete images' },

      // Communication
      { resource: 'message', action: 'create', description: 'Send messages' },
      { resource: 'message', action: 'read', description: 'View messages' },
      { resource: 'message', action: 'update', description: 'Update messages' },
      { resource: 'message', action: 'delete', description: 'Delete messages' },

      { resource: 'channel', action: 'create', description: 'Create channels' },
      { resource: 'channel', action: 'read', description: 'View channels' },
      { resource: 'channel', action: 'update', description: 'Update channels' },
      { resource: 'channel', action: 'delete', description: 'Delete channels' },
      { resource: 'channel', action: 'manage', description: 'Full channel management' },

      // Comments and Annotations
      { resource: 'comment', action: 'create', description: 'Create comments' },
      { resource: 'comment', action: 'read', description: 'View comments' },
      { resource: 'comment', action: 'update', description: 'Update comments' },
      { resource: 'comment', action: 'delete', description: 'Delete comments' },

      { resource: 'annotation', action: 'create', description: 'Create annotations' },
      { resource: 'annotation', action: 'read', description: 'View annotations' },
      { resource: 'annotation', action: 'update', description: 'Update annotations' },
      { resource: 'annotation', action: 'delete', description: 'Delete annotations' }
    ];

    const createdPermissions = [];
    for (const permData of permissions) {
      const permission = await prisma.permission.upsert({
        where: {
          resource_action: {
            resource: permData.resource,
            action: permData.action
          }
        },
        update: {},
        create: {
          name: `${permData.resource}:${permData.action}`,
          resource: permData.resource,
          action: permData.action,
          description: permData.description,
          isSystem: true
        }
      });
      createdPermissions.push(permission);
    }

    console.log(`✅ Created ${createdPermissions.length} permissions`);

    // 2. Create System Roles
    console.log('Creating system roles...');

    // Super Admin Role (all permissions)
    const superAdminRole = await prisma.role.upsert({
      where: { name: 'super_admin' },
      update: {},
      create: {
        name: 'super_admin',
        description: 'Super administrator with full system access',
        isSystem: true
      }
    });

    // Admin Role (most permissions except system-level)
    const adminRole = await prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrator with user and project management access',
        isSystem: true
      }
    });

    // Moderator Role (content management permissions)
    const moderatorRole = await prisma.role.upsert({
      where: { name: 'moderator' },
      update: {},
      create: {
        name: 'moderator',
        description: 'Moderator with content management permissions',
        isSystem: true
      }
    });

    // Member Role (basic user permissions)
    const memberRole = await prisma.role.upsert({
      where: { name: 'member' },
      update: {},
      create: {
        name: 'member',
        description: 'Regular member with basic collaboration permissions',
        isSystem: true
      }
    });

    console.log('✅ Created system roles');

    // 3. Assign Permissions to Roles
    console.log('Assigning permissions to roles...');

    // Super Admin - All permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: superAdminRole.id } });
    await prisma.rolePermission.createMany({
      data: createdPermissions.map(p => ({
        roleId: superAdminRole.id,
        permissionId: p.id
      }))
    });

    // Admin - User, project, and content management permissions
    const adminPermissions = createdPermissions.filter(p =>
      p.resource !== 'admin' || p.action === 'users'
    );
    await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
    await prisma.rolePermission.createMany({
      data: adminPermissions.map(p => ({
        roleId: adminRole.id,
        permissionId: p.id
      }))
    });

    // Moderator - Content and communication permissions
    const moderatorPermissions = createdPermissions.filter(p =>
      ['project', 'scene', 'image', 'message', 'channel', 'comment', 'annotation'].includes(p.resource) &&
      ['read', 'update', 'delete', 'manage'].includes(p.action)
    );
    await prisma.rolePermission.deleteMany({ where: { roleId: moderatorRole.id } });
    await prisma.rolePermission.createMany({
      data: moderatorPermissions.map(p => ({
        roleId: moderatorRole.id,
        permissionId: p.id
      }))
    });

    // Member - Basic read and create permissions
    const memberPermissions = createdPermissions.filter(p =>
      !p.resource.startsWith('admin') &&
      ['create', 'read'].includes(p.action) &&
      !['user', 'channel'].includes(p.resource)
    );
    await prisma.rolePermission.deleteMany({ where: { roleId: memberRole.id } });
    await prisma.rolePermission.createMany({
      data: memberPermissions.map(p => ({
        roleId: memberRole.id,
        permissionId: p.id
      }))
    });

    console.log('✅ Assigned permissions to roles');

    // 4. Assign Super Admin role to existing admin users
    console.log('Assigning super admin role to existing admin users...');

    const adminUsers = await prisma.user.findMany({
      where: { isAdmin: true }
    });

    for (const user of adminUsers) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: superAdminRole.id
          }
        },
        update: { isActive: true },
        create: {
          userId: user.id,
          roleId: superAdminRole.id,
          isActive: true
        }
      });
    }

    console.log(`✅ Assigned super admin role to ${adminUsers.length} admin users`);

    // 5. Create Default System Settings
    console.log('Creating default system settings...');

    const defaultSettings = [
      // General Settings
      { key: 'site_name', value: 'Studio Collaboration Platform', type: 'string', category: 'general', isPublic: true, description: 'The name of the platform' },
      { key: 'maintenance_mode', value: 'false', type: 'boolean', category: 'general', isPublic: true, description: 'Enable maintenance mode to restrict access' },
      { key: 'registration_enabled', value: 'true', type: 'boolean', category: 'general', isPublic: true, description: 'Allow new user registrations' },

      // File Upload Settings
      { key: 'max_file_size', value: '10485760', type: 'number', category: 'uploads', isPublic: false, description: 'Maximum file upload size in bytes (10MB)' },
      { key: 'allowed_image_types', value: '["jpg", "jpeg", "png", "gif", "webp"]', type: 'json', category: 'uploads', isPublic: false, description: 'Allowed image file extensions' },
      { key: 'max_images_per_scene', value: '50', type: 'number', category: 'uploads', isPublic: false, description: 'Maximum number of images per scene' },

      // Security Settings
      { key: 'session_timeout', value: '86400', type: 'number', category: 'security', isPublic: false, description: 'Session timeout in seconds (24 hours)' },
      { key: 'password_min_length', value: '8', type: 'number', category: 'security', isPublic: true, description: 'Minimum password length' },
      { key: 'require_email_verification', value: 'true', type: 'boolean', category: 'security', isPublic: true, description: 'Require email verification for new accounts' },

      // Feature Toggles
      { key: 'enable_real_time', value: 'true', type: 'boolean', category: 'features', isPublic: false, description: 'Enable real-time collaboration features' },
      { key: 'enable_notifications', value: 'true', type: 'boolean', category: 'features', isPublic: false, description: 'Enable notification system' },
      { key: 'enable_analytics', value: 'true', type: 'boolean', category: 'features', isPublic: false, description: 'Enable analytics data collection' },

      // Performance Settings
      { key: 'api_rate_limit', value: '100', type: 'number', category: 'performance', isPublic: false, description: 'API requests per minute per user' },
      { key: 'database_query_timeout', value: '30000', type: 'number', category: 'performance', isPublic: false, description: 'Database query timeout in milliseconds' },
      { key: 'cache_ttl', value: '3600', type: 'number', category: 'performance', isPublic: false, description: 'Cache time-to-live in seconds' }
    ];

    for (const setting of defaultSettings) {
      await prisma.systemSetting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting
      });
    }

    console.log(`✅ Created ${defaultSettings.length} default system settings`);

    // 6. Create Sample Analytics Data
    console.log('Creating sample analytics data...');

    const now = new Date();
    const sampleMetrics = [
      { metric: 'daily_active_users', value: 15, aggregation: 'daily' },
      { metric: 'projects_created', value: 3, aggregation: 'daily' },
      { metric: 'images_uploaded', value: 25, aggregation: 'daily' },
      { metric: 'scenes_created', value: 8, aggregation: 'daily' },
      { metric: 'comments_created', value: 42, aggregation: 'daily' },
      { metric: 'total_users', value: 150, aggregation: 'total' },
      { metric: 'total_projects', value: 45, aggregation: 'total' },
      { metric: 'storage_used_mb', value: 2048, aggregation: 'total' }
    ];

    for (const metric of sampleMetrics) {
      await prisma.analytics.create({
        data: {
          ...metric,
          timestamp: now
        }
      });
    }

    console.log(`✅ Created ${sampleMetrics.length} sample analytics entries`);

    console.log('🎉 Admin system seeding completed successfully!');

    // Print summary
    const roleCount = await prisma.role.count();
    const permissionCount = await prisma.permission.count();
    const settingCount = await prisma.systemSetting.count();

    console.log('\n📊 Summary:');
    console.log(`   Roles: ${roleCount}`);
    console.log(`   Permissions: ${permissionCount}`);
    console.log(`   System Settings: ${settingCount}`);
    console.log(`   Admin Users: ${adminUsers.length}`);

  } catch (error) {
    console.error('❌ Error seeding admin data:', error);
    throw error;
  }
}

// Run the seed function
seedAdminData()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });