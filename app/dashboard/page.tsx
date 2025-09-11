'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Computer,
  AlertTriangle,
  Users,
  Menu,
  X,
  User,
  Settings,
  LogOut,
  Plus,
  UserPlus,
  Download,
  Upload
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { AddEmployeeForm } from '@/components/AddEmployeeForm';
import { EmployeeList } from '@/components/EmployeeList';
import { ImportEmployeeCSV } from '@/components/ImportEmployeeCSV';
import { CSVLink } from 'react-csv';
import { useTitle } from '@/hook/useTitle';
import ITIssuesPage from '@/app/it-issues/page';

// Type definitions
interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  requiredRole?: 'ADMIN';
}

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string;
  department?: string;
}

interface ExtendedSession {
  user?: User;
}

// Interface for employee data from API
interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  nickname?: string;
  phone?: string;
  email: string;
  position: string;
  affiliation?: string;
  hireDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  dept: {
    id: number;
    name: string;
    code: string;
    description?: string;
  };
  user?: {
    id: string;
    role: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Interface for CSV export data
interface EmployeeCSVData {
  'ลำดับ': number;
  'ชื่อ': string;
  'นามสกุล': string;
  'ชื่อเล่น': string;
  'ชื่อ-นามสกุล': string;
  'ตำแหน่ง': string;
  'สังกัด': string;
  'แผนก': string;
  'อีเมล': string;
  'เบอร์โทร': string;
  'วันที่เข้าทำงาน': string;
  'สถานะ': string;
  'บัญชีผู้ใช้': string;
  'วันที่สร้างข้อมูล': string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession() as { data: ExtendedSession | null; status: string };
  const [selectedMenu, setSelectedMenu] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [employeeStats, setEmployeeStats] = useState({
    total: 0,
    active: 0,
    admin: 0,
    academic: 0
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const user = session?.user;
  const isAdmin = user?.role === 'ADMIN';
  useTitle('Dashboard');

  // Fetch employee statistics
  const fetchEmployeeStats = useCallback(async () => {
    if (isAdmin) {
      try {
        const response = await fetch('/api/employees');
        if (response.ok) {
          const data = await response.json();
          const employees: Employee[] = data.employees;
          
          // Store all employees for CSV export
          setAllEmployees(employees);
          
          const stats = {
            total: employees.length,
            active: employees.filter((emp: Employee) => emp.status === 'ACTIVE').length,
            admin: employees.filter((emp: Employee) => emp.dept.code === 'ADMIN').length,
            academic: employees.filter((emp: Employee) => emp.dept.code === 'ACADEMIC').length
          };
          
          setEmployeeStats(stats);
        }
      } catch (error) {
        console.error('Error fetching employee stats:', error);
      }
    }
  }, [isAdmin]);

  // Fetch stats on component mount and when refreshTrigger changes
  useEffect(() => {
    fetchEmployeeStats();
  }, [fetchEmployeeStats, refreshTrigger]);

  const handleEmployeeAdded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Redirect if not authenticated
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    redirect('/login');
  }

  // Menu items configuration
  const menuItems: MenuItem[] = [
    {
      id: 'it-equipment',
      label: 'IT-Equipments',
      icon: Computer,
      description: 'จัดการครุภัณฑ์ไอทีขององค์กร'
    },
    {
      id: 'it-support',
      label: 'IT Support',
      icon: AlertTriangle,
      description: 'แจ้งปัญหาไอทีและติดตามสถานะ'
    },
    {
      id: 'employee-management',
      label: 'จัดการพนักงาน',
      icon: Users,
      description: 'จัดการข้อมูลพนักงานและสิทธิ์',
      requiredRole: 'ADMIN'
    },
    {
      id: 'add-employee',
      label: 'เพิ่มพนักงาน',
      icon: UserPlus,
      description: 'เพิ่มข้อมูลพนักงานใหม่',
      requiredRole: 'ADMIN'
    },
    {
      id: 'import-employee',
      label: 'นำเข้าจาก CSV',
      icon: Upload,
      description: 'นำเข้าข้อมูลพนักงานจากไฟล์ CSV',
      requiredRole: 'ADMIN'
    }
  ];

  // Filter menu items based on user role
  const availableMenuItems = menuItems.filter(item => 
    !item.requiredRole || (item.requiredRole === 'ADMIN' && isAdmin)
  );

  const handleMenuClick = (menuId: string) => {
    // Check if user has permission for this menu item
    const menuItem = menuItems.find(item => item.id === menuId);
    if (menuItem?.requiredRole === 'ADMIN' && !isAdmin) {
      // If user tries to access admin-only content, redirect to access denied
      window.location.href = '/access-denied';
      return;
    }
    
    setSelectedMenu(menuId);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  // Prepare CSV data
  const prepareCsvData = (): EmployeeCSVData[] => {
    return allEmployees.map((employee, index) => ({
      'ลำดับ': index + 1,
      'ชื่อ': employee.firstName,
      'นามสกุล': employee.lastName,
      'ชื่อเล่น': employee.nickname || '-',
      'ชื่อ-นามสกุล': `${employee.firstName} ${employee.lastName}`,
      'ตำแหน่ง': employee.position,
      'สังกัด': employee.affiliation || '-',
      'แผนก': employee.dept.name,
      'อีเมล': employee.email,
      'เบอร์โทร': employee.phone || '-',
      'วันที่เข้าทำงาน': new Date(employee.hireDate).toLocaleDateString('th-TH'),
      'สถานะ': employee.status === 'ACTIVE' ? 'ทำงานอยู่' : employee.status === 'INACTIVE' ? 'ไม่ทำงาน' : 'ถูกระงับ',
      'บัญชีผู้ใช้': employee.user ? (employee.user.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน') : '-',
      'วันที่สร้างข้อมูล': new Date(employee.createdAt).toLocaleDateString('th-TH')
    }));
  };

  // Generate filename with current date
  const generateFileName = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH').replace(/\//g, '-');
    const timeStr = now.toLocaleTimeString('th-TH', { hour12: false }).replace(/:/g, '-');
    return `รายชื่อพนักงาน_${dateStr}_${timeStr}.csv`;
  };

  // Handle CSV export
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      // Refresh data before export
      await fetchEmployeeStats();
    } catch (error) {
      console.error('Error preparing export:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const renderContent = () => {
    switch (selectedMenu) {
      case 'it-equipment':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">ครุภัณฑ์ไอที</h2>
              <p className="text-gray-600">จัดการและติดตามครุภัณฑ์ไอที</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>ครุภัณฑ์ไอทีของฉัน</CardTitle>
                <CardDescription>รายการครุภัณฑ์ที่ได้รับมอบหมาย</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">กำลังอยู่ในช่วงพัฒนา</p>
              </CardContent>
            </Card>
          </div>
        );
      
      case 'it-support':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">แจ้งปัญหาไอที</h2>
              <p className="text-gray-600">แจ้งปัญหาและขอรับการซ่อมแซม</p>
            </div>
            <ITIssuesPage />
          </div>
        );
      
      case 'employee-management':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">จัดการพนักงาน</h2>
                <p className="text-gray-600">จัดการข้อมูลพนักงานและสิทธิ์การเข้าถึง</p>
              </div>
              <div className="flex items-center space-x-3">
                {allEmployees.length > 0 && (
                  <CSVLink
                    data={prepareCsvData()}
                    filename={generateFileName()}
                    className="inline-flex"
                    onClick={handleExportCSV}
                  >
                    <Button 
                      variant="outline" 
                      className="flex items-center space-x-2"
                      disabled={isExporting}
                    >
                      <Download className="h-4 w-4" />
                      <span>{isExporting ? 'กำลังเตรียมข้อมูล...' : 'Export CSV'}</span>
                    </Button>
                  </CSVLink>
                )}
                <Button onClick={() => handleMenuClick('import-employee')} variant="outline" className="flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>นำเข้า CSV</span>
                </Button>
                <Button onClick={() => handleMenuClick('add-employee')} className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>เพิ่มพนักงาน</span>
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>พนักงานทั้งหมด</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-600">{employeeStats.total}</p>
                  <p className="text-sm text-gray-600">คน</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>พนักงานปัจจุบัน</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">{employeeStats.active}</p>
                  <p className="text-sm text-gray-600">คน (ทำงานอยู่)</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>แผนกบริหาร</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-orange-600">{employeeStats.admin}</p>
                  <p className="text-sm text-gray-600">คน</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>แผนกวิชาการ</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-purple-600">{employeeStats.academic}</p>
                  <p className="text-sm text-gray-600">คน</p>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>รายชื่อพนักงาน</CardTitle>
                <CardDescription>รายชื่อพนักงานทั้งหมดในระบบ</CardDescription>
              </CardHeader>
              <CardContent>
                <EmployeeList refreshTrigger={refreshTrigger} userRole={user?.role} />
              </CardContent>
            </Card>
          </div>
        );
      
      case 'add-employee':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                onClick={() => handleMenuClick('employee-management')}
                className="flex items-center space-x-2"
              >
                <Users className="h-4 w-4" />
                <span>กลับไปรายชื่อ</span>
              </Button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">เพิ่มพนักงานใหม่</h2>
                <p className="text-gray-600">เพิ่มข้อมูลพนักงานใหม่เข้าระบบ</p>
              </div>
            </div>
            <AddEmployeeForm onSuccess={handleEmployeeAdded} />
          </div>
        );
      
      case 'import-employee':
        return (
          <ImportEmployeeCSV 
            onSuccess={handleEmployeeAdded}
            onBack={() => handleMenuClick('employee-management')}
          />
        );
      
      default:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">ยินดีต้อนรับ, {user?.name}</h2>
              <p className="text-gray-600">ระบบจัดการพนักงาน</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableMenuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Card 
                    key={item.id} 
                    className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
                    onClick={() => handleMenuClick(item.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center space-x-3">
                        <IconComponent className="h-8 w-8 text-blue-600" />
                        <CardTitle className="text-lg">{item.label}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{item.description}</CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={cn(
        "bg-white shadow-lg border-r border-gray-200 transition-all duration-300 flex flex-col",
        sidebarOpen ? "w-64" : "w-16"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold text-gray-800">ระบบจัดการ</h1>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <Button
            variant={selectedMenu === 'dashboard' ? 'default' : 'ghost'}
            className={cn(
              "w-full justify-start",
              !sidebarOpen && "justify-center px-2"
            )}
            onClick={() => handleMenuClick('dashboard')}
          >
            <Settings className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2">แดชบอร์ด</span>}
          </Button>
          
          <Separator className="my-2" />
          
          {availableMenuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Button
                key={item.id}
                variant={selectedMenu === item.id ? 'default' : 'ghost'}
                className={cn(
                  "w-full justify-start",
                  !sidebarOpen && "justify-center px-2"
                )}
                onClick={() => handleMenuClick(item.id)}
              >
                <IconComponent className="h-4 w-4" />
                {sidebarOpen && <span className="ml-2">{item.label}</span>}
              </Button>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-gray-200">
          {sidebarOpen && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                  <p className="text-xs text-blue-600">
                    {user?.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'} | {user?.department}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <Button
            variant="ghost"
            className={cn(
              "w-full text-red-600 hover:text-red-700 hover:bg-red-50",
              sidebarOpen ? "justify-start" : "justify-center px-2"
            )}
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            {sidebarOpen && <span className="ml-2">ออกจากระบบ</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Menu Button */}
        <div className="md:hidden p-4 border-b border-gray-200 bg-white">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-4 w-4" />
            <span className="ml-2">เมนู</span>
          </Button>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}