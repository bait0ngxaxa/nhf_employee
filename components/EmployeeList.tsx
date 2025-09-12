'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronLeft, ChevronRight, Download, Edit, Settings, Filter } from 'lucide-react';
import { CSVLink } from 'react-csv';
import { EditStatusModal } from '@/components/EditStatusModal';
import { EditEmployeeForm } from '@/components/EditEmployeeForm';

interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
}

interface User {
  id: number;
  email: string;
  role: string;
}

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
  dept: Department;
  user?: User;
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

interface EmployeeListProps {
  refreshTrigger?: number;
  userRole?: string;
}

export function EmployeeList({ refreshTrigger, userRole }: EmployeeListProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isExporting, setIsExporting] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);

  // Pagination calculations
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEmployees = filteredEmployees.slice(startIndex, endIndex);

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/employees');
      
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees);
        setFilteredEmployees(data.employees);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล');
      }
    } catch (error) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      console.error('Error fetching employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [refreshTrigger]);

  useEffect(() => {
    const filtered = employees.filter(employee => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        employee.firstName.toLowerCase().includes(searchLower) ||
        employee.lastName.toLowerCase().includes(searchLower) ||
        (employee.nickname && employee.nickname.toLowerCase().includes(searchLower)) ||
        employee.email.toLowerCase().includes(searchLower) ||
        employee.position.toLowerCase().includes(searchLower) ||
        employee.dept.name.toLowerCase().includes(searchLower) ||
        (employee.affiliation && employee.affiliation.toLowerCase().includes(searchLower))
      );
      
      const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
    setFilteredEmployees(filtered);
    setCurrentPage(1); // Reset to first page when search or filter changes
  }, [searchTerm, statusFilter, employees]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800">ทำงานอยู่</Badge>;
      case 'INACTIVE':
        return <Badge variant="secondary">ไม่ทำงาน</Badge>;
      case 'SUSPENDED':
        return <Badge variant="destructive">ถูกระงับ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };



  // Utility function for date formatting (currently used in CSV export)
  // const formatDate = (dateString: string) => {
  //   return new Date(dateString).toLocaleDateString('th-TH');
  // };

  // Prepare CSV data for filtered employees
  const prepareCsvData = (): EmployeeCSVData[] => {
    return filteredEmployees.map((employee, index) => ({
      'ลำดับ': index + 1,
      'ชื่อ': employee.firstName,
      'นามสกุล': employee.lastName,
      'ชื่อเล่น': employee.nickname || '-',
      'ชื่อ-นามสกุล': `${employee.firstName} ${employee.lastName}`,
      'ตำแหน่ง': employee.position,
      'สังกัด': employee.affiliation || '-',
      'แผนก': employee.dept.name,
      'อีเมล': employee.email.includes('@temp.local') ? '-' : employee.email,
      'เบอร์โทร': employee.phone || '-',
      'วันที่เข้าทำงาน': new Date(employee.hireDate).toLocaleDateString('th-TH'),
      'สถานะ': employee.status === 'ACTIVE' ? 'ทำงานอยู่' : employee.status === 'INACTIVE' ? 'ไม่ทำงาน' : 'ถูกระงับ',
      'บัญชีผู้ใช้': employee.user ? (employee.user.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน') : '-',
      'วันที่สร้างข้อมูล': new Date(employee.createdAt).toLocaleDateString('th-TH')
    }));
  };

  // Generate filename with current date, search term, and status filter
  const generateFileName = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH').replace(/\//g, '-');
    const timeStr = now.toLocaleTimeString('th-TH', { hour12: false }).replace(/:/g, '-');
    const searchSuffix = searchTerm ? `_ค้นหา-${searchTerm}` : '';
    const statusSuffix = statusFilter !== 'all' ? `_สถานะ-${getStatusLabel(statusFilter)}` : '';
    return `รายชื่อพนักงาน${searchSuffix}${statusSuffix}_${dateStr}_${timeStr}.csv`;
  };

  // Get status label in Thai
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'ทำงานอยู่';
      case 'INACTIVE': return 'ไม่ทำงาน';
      case 'SUSPENDED': return 'ถูกระงับ';
      default: return status;
    }
  };

  // Handle CSV export
  const handleExportCSV = () => {
    setIsExporting(true);
    // Reset export state after a short delay
    setTimeout(() => setIsExporting(false), 1000);
  };

  // Handle edit status
  const handleEditStatus = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingEmployee(null);
  };

  const handleStatusUpdate = (employeeId: number, newStatus: string) => {
    // Update the employee in the local state
    setEmployees(prev => prev.map(emp => 
      emp.id === employeeId 
        ? { ...emp, status: newStatus as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' }
        : emp
    ));
    setFilteredEmployees(prev => prev.map(emp => 
      emp.id === employeeId 
        ? { ...emp, status: newStatus as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' }
        : emp
    ));
  };

  // Handle edit employee
  const handleEditEmployee = (employee: Employee) => {
    setEmployeeToEdit(employee);
    setIsEditFormOpen(true);
  };

  const handleCloseEditForm = () => {
    setIsEditFormOpen(false);
    setEmployeeToEdit(null);
  };

  const handleEmployeeUpdate = () => {
    // Refresh the employee list after successful update
    fetchEmployees();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">กำลังโหลดข้อมูลพนักงาน...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-600 bg-red-50 p-4 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar, Status Filter and Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-3">
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="ค้นหาพนักงาน (ชื่อ, ชื่อเล่น, อีเมล, ตำแหน่ง, แผนก, สังกัด)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full">
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <SelectValue placeholder="กรองตามสถานะ" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                <SelectItem value="ACTIVE">ทำงานอยู่</SelectItem>
                <SelectItem value="INACTIVE">ไม่ทำงาน</SelectItem>
                <SelectItem value="SUSPENDED">ถูกระงับ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {filteredEmployees.length > 0 && (
          <CSVLink
            data={prepareCsvData()}
            filename={generateFileName()}
            className="inline-flex"
            onClick={handleExportCSV}
          >
            <Button 
              variant="outline" 
              className="flex items-center space-x-2 whitespace-nowrap"
              disabled={isExporting}
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'กำลังเตรียม...' : `Export CSV (${filteredEmployees.length} คน)`}</span>
            </Button>
          </CSVLink>
        )}
      </div>

      {/* Results Summary and Pagination Info */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
        <div className="text-sm text-gray-600">
          แสดงผล {startIndex + 1}-{Math.min(endIndex, filteredEmployees.length)} จาก {filteredEmployees.length} คน 
          {statusFilter !== 'all' && (
            <span className="text-blue-600">(กรองตามสถานะ: {getStatusLabel(statusFilter)})</span>
          )}
          {searchTerm && (
            <span className="text-green-600">(ค้นหา: &quot;{searchTerm}&quot;)</span>
          )}
          <span className="text-gray-500">(ทั้งหมด {employees.length} คน)</span>
        </div>
        {totalPages > 1 && (
          <div className="text-sm text-gray-600">
            หน้า {currentPage} จาก {totalPages}
          </div>
        )}
      </div>

      {/* Employee Table */}
      {filteredEmployees.length === 0 ? (
        <div className="text-center p-8 text-gray-500">
          {searchTerm || statusFilter !== 'all' 
            ? 'ไม่พบพนักงานที่ตรงกับเงื่อนไขการค้นหาหรือการกรอง' 
            : 'ยังไม่มีข้อมูลพนักงาน'
          }
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  ชื่อ-นามสกุล
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  ชื่อเล่น
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  ตำแหน่ง
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  สังกัด
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  แผนก
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  อีเมล
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  เบอร์โทร
                </th>
                
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  สถานะ
                </th>
                
                {userRole === 'ADMIN' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                    การจัดการ
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {employee.firstName} {employee.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {employee.nickname ? (
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs">
                          {employee.nickname}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{employee.position}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{employee.affiliation || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="outline">{employee.dept.name}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {employee.email.includes('@temp.local') ? '-' : employee.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{employee.phone || '-'}</div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(employee.status)}
                  </td>
                 
                  {userRole === 'ADMIN' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditEmployee(employee)}
                          className="flex items-center space-x-1 text-green-600 hover:text-green-700"
                        >
                          <Edit className="h-3 w-3" />
                          <span>แก้ไข</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditStatus(employee)}
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
                        >
                          <Settings className="h-3 w-3" />
                          <span>สถานะ</span>
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="flex items-center space-x-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>ก่อนหน้า</span>
            </Button>
            
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current page
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 2 && page <= currentPage + 2)
                ) {
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="min-w-[40px]"
                    >
                      {page}
                    </Button>
                  );
                } else if (
                  page === currentPage - 3 ||
                  page === currentPage + 3
                ) {
                  return (
                    <span key={page} className="px-2 text-gray-400">
                      ...
                    </span>
                  );
                }
                return null;
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center space-x-1"
            >
              <span>ถัดไป</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-sm text-gray-600">
            แสดงผล {itemsPerPage} รายการต่อหน้า
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      <EditStatusModal
        employee={editingEmployee}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onStatusUpdate={handleStatusUpdate}
      />

      {/* Edit Employee Form */}
      <EditEmployeeForm
        employee={employeeToEdit}
        isOpen={isEditFormOpen}
        onClose={handleCloseEditForm}
        onSuccess={handleEmployeeUpdate}
      />
    </div>
  );
}