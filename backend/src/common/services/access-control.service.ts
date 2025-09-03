import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit.service';
import { AuditAction, AuditLevel } from '../entities/audit-log.entity';

export enum Permission {
  READ_QUESTIONS = 'read:questions',
  WRITE_QUESTIONS = 'write:questions',
  DELETE_QUESTIONS = 'delete:questions',
  READ_COURSES = 'read:courses',
  WRITE_COURSES = 'write:courses',
  DELETE_COURSES = 'delete:courses',
  READ_AUDIT_LOGS = 'read:audit_logs',
  EXPORT_DATA = 'export:data',
  MANAGE_BACKUPS = 'manage:backups',
  MANAGE_USERS = 'manage:users',
  ADMIN = 'admin',
}

export enum Role {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

export interface User {
  id: string;
  email: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  lastLoginAt?: Date;
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  ipAddress: string;
  userAgent: string;
  context?: Record<string, any>;
}

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  // Role-based permissions mapping
  private readonly rolePermissions: Record<Role, Permission[]> = {
    [Role.STUDENT]: [
      Permission.READ_QUESTIONS,
    ],
    [Role.TEACHER]: [
      Permission.READ_QUESTIONS,
      Permission.WRITE_QUESTIONS,
      Permission.READ_COURSES,
      Permission.WRITE_COURSES,
      Permission.EXPORT_DATA,
    ],
    [Role.ADMIN]: [
      Permission.READ_QUESTIONS,
      Permission.WRITE_QUESTIONS,
      Permission.DELETE_QUESTIONS,
      Permission.READ_COURSES,
      Permission.WRITE_COURSES,
      Permission.DELETE_COURSES,
      Permission.READ_AUDIT_LOGS,
      Permission.EXPORT_DATA,
      Permission.MANAGE_BACKUPS,
      Permission.MANAGE_USERS,
      Permission.ADMIN,
    ],
    [Role.SYSTEM]: [
      Permission.READ_QUESTIONS,
      Permission.WRITE_QUESTIONS,
      Permission.READ_COURSES,
      Permission.WRITE_COURSES,
      Permission.READ_AUDIT_LOGS,
      Permission.MANAGE_BACKUPS,
      Permission.ADMIN,
    ],
  };

  // Resource-action mapping
  private readonly resourceActions: Record<string, Permission[]> = {
    'questions': [Permission.READ_QUESTIONS, Permission.WRITE_QUESTIONS, Permission.DELETE_QUESTIONS],
    'courses': [Permission.READ_COURSES, Permission.WRITE_COURSES, Permission.DELETE_COURSES],
    'audit_logs': [Permission.READ_AUDIT_LOGS],
    'backups': [Permission.MANAGE_BACKUPS],
    'users': [Permission.MANAGE_USERS],
    'exports': [Permission.EXPORT_DATA],
  };

  constructor(
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  /**
   * Check if user has permission for specific action
   */
  async checkPermission(request: AccessRequest): Promise<boolean> {
    try {
      // Get user (in real implementation, this would come from authentication)
      const user = await this.getUser(request.userId);
      
      if (!user || !user.isActive) {
        await this.logAccessDenied(request, 'User not found or inactive');
        return false;
      }

      // Check if user has admin role
      if (user.role === Role.ADMIN || user.permissions.includes(Permission.ADMIN)) {
        await this.logAccessGranted(request, user);
        return true;
      }

      // Get required permission for the action
      const requiredPermission = this.getRequiredPermission(request.resource, request.action);
      
      if (!requiredPermission) {
        await this.logAccessDenied(request, 'Invalid resource or action');
        return false;
      }

      // Check if user has the required permission
      const hasPermission = user.permissions.includes(requiredPermission);
      
      if (hasPermission) {
        await this.logAccessGranted(request, user);
      } else {
        await this.logAccessDenied(request, `Missing permission: ${requiredPermission}`);
      }

      return hasPermission;
    } catch (error) {
      this.logger.error('Permission check failed:', error);
      await this.logAccessDenied(request, `Error: ${error.message}`);
      return false;
    }
  }

  /**
   * Enforce permission check and throw exception if denied
   */
  async enforcePermission(request: AccessRequest): Promise<void> {
    const hasPermission = await this.checkPermission(request);
    
    if (!hasPermission) {
      throw new ForbiddenException('Access denied: Insufficient permissions');
    }
  }

  /**
   * Get user permissions for a specific resource
   */
  async getUserResourcePermissions(userId: string, resource: string): Promise<Permission[]> {
    const user = await this.getUser(userId);
    
    if (!user || !user.isActive) {
      return [];
    }

    const resourcePermissions = this.resourceActions[resource] || [];
    return user.permissions.filter(permission => resourcePermissions.includes(permission));
  }

  /**
   * Check if user can perform action on specific resource
   */
  async canPerformAction(userId: string, resource: string, action: string): Promise<boolean> {
    const request: AccessRequest = {
      userId,
      resource,
      action,
      ipAddress: 'unknown',
      userAgent: 'unknown',
    };

    return this.checkPermission(request);
  }

  /**
   * Get all permissions for a role
   */
  getRolePermissions(role: Role): Permission[] {
    return this.rolePermissions[role] || [];
  }

  /**
   * Validate user permissions against role
   */
  validateUserPermissions(user: User): boolean {
    const rolePermissions = this.getRolePermissions(user.role);
    
    // Check if user has all role permissions
    for (const permission of rolePermissions) {
      if (!user.permissions.includes(permission)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get required permission for resource and action
   */
  private getRequiredPermission(resource: string, action: string): Permission | null {
    const resourcePermissions = this.resourceActions[resource];
    
    if (!resourcePermissions) {
      return null;
    }

    // Map actions to permissions
    const actionPermissionMap: Record<string, Permission> = {
      'read': this.getReadPermission(resource),
      'write': this.getWritePermission(resource),
      'create': this.getWritePermission(resource),
      'update': this.getWritePermission(resource),
      'delete': this.getDeletePermission(resource),
    };

    return actionPermissionMap[action.toLowerCase()] || null;
  }

  /**
   * Get read permission for resource
   */
  private getReadPermission(resource: string): Permission {
    const permissionMap: Record<string, Permission> = {
      'questions': Permission.READ_QUESTIONS,
      'courses': Permission.READ_COURSES,
      'audit_logs': Permission.READ_AUDIT_LOGS,
    };
    return permissionMap[resource];
  }

  /**
   * Get write permission for resource
   */
  private getWritePermission(resource: string): Permission {
    const permissionMap: Record<string, Permission> = {
      'questions': Permission.WRITE_QUESTIONS,
      'courses': Permission.WRITE_COURSES,
    };
    return permissionMap[resource];
  }

  /**
   * Get delete permission for resource
   */
  private getDeletePermission(resource: string): Permission {
    const permissionMap: Record<string, Permission> = {
      'questions': Permission.DELETE_QUESTIONS,
      'courses': Permission.DELETE_COURSES,
    };
    return permissionMap[resource];
  }

  /**
   * Get user by ID (mock implementation)
   */
  private async getUser(userId: string): Promise<User | null> {
    // In real implementation, this would query the database
    // For now, return a mock user based on configuration
    const mockUsers: Record<string, User> = {
      'system': {
        id: 'system',
        email: 'system@ehou.edu.vn',
        role: Role.SYSTEM,
        permissions: this.getRolePermissions(Role.SYSTEM),
        isActive: true,
      },
      'admin': {
        id: 'admin',
        email: 'admin@ehou.edu.vn',
        role: Role.ADMIN,
        permissions: this.getRolePermissions(Role.ADMIN),
        isActive: true,
      },
      'teacher': {
        id: 'teacher',
        email: 'teacher@ehou.edu.vn',
        role: Role.TEACHER,
        permissions: this.getRolePermissions(Role.TEACHER),
        isActive: true,
      },
      'student': {
        id: 'student',
        email: 'student@ehou.edu.vn',
        role: Role.STUDENT,
        permissions: this.getRolePermissions(Role.STUDENT),
        isActive: true,
      },
    };

    return mockUsers[userId] || null;
  }

  /**
   * Log access granted
   */
  private async logAccessGranted(request: AccessRequest, user: User): Promise<void> {
    await this.auditService.log({
      action: AuditAction.READ,
      resource: request.resource,
      userId: user.id,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      details: {
        action: request.action,
        role: user.role,
        permissions: user.permissions,
        context: request.context,
      },
      level: AuditLevel.INFO,
    });
  }

  /**
   * Log access denied
   */
  private async logAccessDenied(request: AccessRequest, reason: string): Promise<void> {
    await this.auditService.log({
      action: AuditAction.ACCESS_DENIED,
      resource: request.resource,
      userId: request.userId,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      details: {
        action: request.action,
        reason,
        context: request.context,
      },
      level: AuditLevel.WARNING,
    });
  }

  /**
   * Get access control statistics
   */
  async getAccessControlStats(): Promise<Record<string, any>> {
    const stats = {
      roles: Object.values(Role).length,
      permissions: Object.values(Permission).length,
      resources: Object.keys(this.resourceActions).length,
      rolePermissions: this.rolePermissions,
      resourceActions: this.resourceActions,
    };

    return stats;
  }
}
