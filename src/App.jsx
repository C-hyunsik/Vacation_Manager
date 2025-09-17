import { useState, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import VacationAPI from './api.js'
import './App.css'
import './loading.css'

function App() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [vacations, setVacations] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [formData, setFormData] = useState({
    employeeId: '',
    type: '연차',
    startDate: '',
    endDate: '',
    reason: ''
  })

  // Calendar related states
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [modalFormData, setModalFormData] = useState({
    type: '연차',
    reason: '',
    applyToAll: false
  })

  // New states for integrated modal
  const [selectedDateVacations, setSelectedDateVacations] = useState([])
  const [modalMode, setModalMode] = useState('view') // 'view', 'add', 'edit'
  const [editingVacation, setEditingVacation] = useState(null)
  const dashboardRef = useRef(null)

  // Employee management states
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    department: '',
    yearlyAllowance: 15,
    hireDate: ''
  })

  // Employee edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    department: '',
    yearlyAllowance: 15,
    hireDate: '',
    currentRemainingDays: 0
  })

  // 직원 데이터 로드
  useEffect(() => {
    loadEmployees()
    loadVacations()
  }, [])

  const loadEmployees = async () => {
    try {
      setLoading(true)
      const employeeData = await VacationAPI.getEmployees()
      // DB 컬럼명을 React state 형식으로 변환
      const formattedEmployees = employeeData.map(emp => ({
        id: emp.id,
        name: emp.name,
        department: emp.department,
        yearlyAllowance: emp.yearly_allowance,
        hireDate: emp.hire_date,
        lastRenewalDate: emp.last_renewal_date,
        currentRemainingDays: emp.current_remaining_days || 0
      }))
      setEmployees(formattedEmployees)
      setError(null)
    } catch (err) {
      console.error('직원 데이터 로드 실패:', err)
      setError('직원 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadVacations = async () => {
    try {
      const vacationData = await VacationAPI.getVacations()
      // DB 컬럼명을 React state 형식으로 변환
      const formattedVacations = vacationData.map(vac => ({
        id: vac.id,
        employeeId: vac.employee_id,
        employeeName: vac.employee_name,
        type: vac.type,
        startDate: vac.start_date,
        endDate: vac.end_date,
        reason: vac.reason,
        createdAt: vac.created_at
      }))
      setVacations(formattedVacations)
    } catch (err) {
      console.error('휴가 데이터 로드 실패:', err)
      setError('휴가 데이터를 불러오는데 실패했습니다.')
    }
  }

  const getEmployeeVacations = (employeeId) => {
    return vacations.filter(vacation => vacation.employeeId === employeeId)
  }

  // 입사일로부터 13개월이 지났는지 확인 (갱신일 전까지는 1년미만으로 처리)
  const isEmployeeOverOneYear = (hireDate) => {
    const hire = new Date(hireDate)
    const today = new Date()
    const thirteenMonthsAfterHire = new Date(hire.getFullYear() + 1, hire.getMonth() + 1, hire.getDate())
    return today >= thirteenMonthsAfterHire
  }

  // 휴가 년도 계산 (입사일 기준)
  const getVacationYear = (hireDate) => {
    const hire = new Date(hireDate)
    const today = new Date()
    
    // 입사일의 월/일을 기준으로 휴가 년도 계산
    let vacationYear = today.getFullYear()
    if (today.getMonth() < hire.getMonth() || 
        (today.getMonth() === hire.getMonth() && today.getDate() < hire.getDate())) {
      vacationYear = today.getFullYear() - 1
    }
    
    return vacationYear
  }

  // 현재 휴가 년도의 총 휴가 일수 계산
  const getCurrentYearAllowance = (employee) => {
    if (!isEmployeeOverOneYear(employee.hireDate)) {
      return 0 // 1년미만은 기준이 0일
    }
    
    // 갱신 횟수에 따른 휴가 일수 계산
    const renewalCount = getRenewalCount(employee.hireDate, employee.lastRenewalDate)
    return employee.yearlyAllowance * renewalCount
  }

  // 갱신 횟수 계산
  const getRenewalCount = (hireDate, lastRenewalDate) => {
    const hire = new Date(hireDate)
    const today = new Date()
    
    // 첫 갱신일 계산 (입사일 다음달)
    const firstRenewalMonth = hire.getMonth() + 1
    const firstRenewalDay = hire.getDate()
    let firstRenewal = new Date(hire.getFullYear(), firstRenewalMonth > 11 ? 0 : firstRenewalMonth, firstRenewalDay)
    if (firstRenewalMonth > 11) firstRenewal.setFullYear(hire.getFullYear() + 1)
    
    // 현재까지 갱신된 횟수 계산
    let renewalCount = 0
    let currentRenewal = new Date(firstRenewal)
    
    while (currentRenewal <= today) {
      renewalCount++
      currentRenewal.setFullYear(currentRenewal.getFullYear() + 1)
    }
    
    return Math.max(0, renewalCount)
  }

  // 휴가 갱신일 계산 (입사일 다음달로 변경)
  const getNextVacationRenewalDate = (hireDate) => {
    const hire = new Date(hireDate)
    const today = new Date()
    
    // 입사일 다음달의 입사일로 설정 (1월 입사 -> 2월 갱신)
    let renewalYear = today.getFullYear()
    let renewalMonth = hire.getMonth() + 1 // 다음달
    let renewalDay = hire.getDate()
    
    // 12월 입사인 경우 다음해 1월로 설정
    if (renewalMonth > 11) {
      renewalMonth = 0
      renewalYear += 1
    }
    
    let renewalDate = new Date(renewalYear, renewalMonth, renewalDay)
    
    // 갱신일이 이미 지났으면 다음해로 설정
    if (renewalDate <= today) {
      renewalYear += 1
      renewalDate = new Date(renewalYear, renewalMonth, renewalDay)
    }
    
    return renewalDate
  }

  const calculateUsedDays = (employeeId) => {
    const employeeVacations = getEmployeeVacations(employeeId)
    return employeeVacations.reduce((total, vacation) => {
      const start = new Date(vacation.startDate)
      const end = new Date(vacation.endDate)
      const diffTime = Math.abs(end - start)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
      
      // 반차는 0.5일로 계산
      if (vacation.type === '반차') {
        return total + (diffDays * 0.5)
      }
      return total + diffDays
    }, 0)
  }

  const getEmployeeStats = (employee) => {
    const usedDays = calculateUsedDays(employee.id)
    const currentAllowance = getCurrentYearAllowance(employee)
    const isOverOneYear = isEmployeeOverOneYear(employee.hireDate)
    
    if (!isOverOneYear) {
      // 1년미만: current_remaining_days가 음수로 설정되어 있으면 그것을 사용한 휴가로 표시
      let actualUsedDays = usedDays
      if (employee.currentRemainingDays !== undefined && employee.currentRemainingDays !== null && employee.currentRemainingDays < 0) {
        actualUsedDays = -employee.currentRemainingDays
      }
      
      return { 
        usedDays: actualUsedDays, 
        remainingDays: 0, 
        currentAllowance: 0,
        isNewEmployee: true,
        nextRenewalDate: getNextVacationRenewalDate(employee.hireDate)
      }
    } else {
      // 현재 남은 휴가 일수가 설정되어 있으면 그것을 우선 사용
      let remainingDays = employee.currentRemainingDays !== undefined && employee.currentRemainingDays !== null 
        ? employee.currentRemainingDays 
        : currentAllowance - usedDays

      return { 
        usedDays, 
        remainingDays, 
        currentAllowance,
        isNewEmployee: false,
        nextRenewalDate: getNextVacationRenewalDate(employee.hireDate)
      }
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.employeeId || !formData.startDate || !formData.endDate) {
      alert('직원, 시작일, 종료일을 모두 선택해주세요.')
      return
    }

    try {
      const employee = employees.find(emp => emp.id === parseInt(formData.employeeId))
      const vacationData = {
        employee_id: parseInt(formData.employeeId),
        type: formData.type,
        start_date: formData.startDate,
        end_date: formData.endDate,
        reason: formData.reason || null
      }

      await VacationAPI.createVacation(vacationData)
      
      // 휴가 데이터와 직원 데이터 모두 재로드 (남은 휴가 실시간 반영)
      await Promise.all([loadVacations(), loadEmployees()])
      
      setFormData({
        employeeId: '',
        type: '연차',
        startDate: '',
        endDate: '',
        reason: ''
      })
      alert(`${employee.name}님의 휴가가 등록되었습니다.`)
    } catch (err) {
      console.error('휴가 등록 실패:', err)
      alert('휴가 등록에 실패했습니다.')
    }
  }

  const deleteVacation = async (id) => {
    if (confirm('휴가를 삭제하시겠습니까?')) {
      try {
        await VacationAPI.deleteVacation(id)
        // 휴가 데이터와 직원 데이터 모두 재로드 (남은 휴가 실시간 반영)
        await Promise.all([loadVacations(), loadEmployees()])
        alert('휴가가 삭제되었습니다.')
      } catch (err) {
        console.error('휴가 삭제 실패:', err)
        alert('휴가 삭제에 실패했습니다.')
      }
    }
  }

  const calculateDays = (start, end, type = '연차') => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffTime = Math.abs(endDate - startDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    
    // 반차는 0.5일로 계산
    if (type === '반차') {
      return diffDays * 0.5
    }
    return diffDays
  }

  // Calendar functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  const getVacationsForDate = (date) => {
    if (!date) return []
    const dateStr = date.toISOString().split('T')[0]
    return vacations.filter(vacation => {
      const startDate = new Date(vacation.startDate)
      const endDate = new Date(vacation.endDate)
      const checkDate = new Date(dateStr)
      return checkDate >= startDate && checkDate <= endDate
    })
  }

  const handleDateClick = (date) => {
    const dateVacations = getVacationsForDate(date)
    setSelectedDate(date)
    setSelectedDateVacations(dateVacations)
    setShowModal(true)

    // 기존 휴가가 있으면 조회 모드, 없으면 등록 모드
    setModalMode(dateVacations.length > 0 ? 'view' : 'add')

    setModalFormData({
      type: '연차',
      reason: '',
      applyToAll: false
    })
    setSelectedEmployees([])
    setEditingVacation(null)
  }

  const handleEmployeeToggle = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId)
      } else {
        return [...prev, employeeId]
      }
    })
  }

  const handleSelectAll = () => {
    if (selectedEmployees.length === employees.length) {
      setSelectedEmployees([])
    } else {
      setSelectedEmployees(employees.map(emp => emp.id))
    }
  }

  const handleModalSubmit = async (e) => {
    e.preventDefault()

    if (modalMode === 'edit' && editingVacation) {
      // 휴가 수정 모드
      try {
        const updatedVacationData = {
          employee_id: editingVacation.employeeId,
          type: modalFormData.type,
          start_date: editingVacation.startDate,
          end_date: editingVacation.endDate,
          reason: modalFormData.reason || null
        }

        await VacationAPI.updateVacation(editingVacation.id, updatedVacationData)

        // 데이터 재로드
        await Promise.all([loadVacations(), loadEmployees()])

        // 선택된 날짜의 휴가 업데이트
        const updatedDateVacations = getVacationsForDate(selectedDate)
        setSelectedDateVacations(updatedDateVacations)

        setModalMode('view')
        setEditingVacation(null)
        alert('휴가가 수정되었습니다.')
      } catch (err) {
        console.error('휴가 수정 실패:', err)
        alert('휴가 수정에 실패했습니다.')
      }
    } else if (modalMode === 'add') {
      // 휴가 등록 모드
      if (selectedEmployees.length === 0) {
        alert('직원을 선택해주세요.')
        return
      }

      try {
        const dateStr = selectedDate.toISOString().split('T')[0]

        // 각 직원에 대해 휴가 등록
        const promises = selectedEmployees.map(employeeId => {
          const vacationData = {
            employee_id: employeeId,
            type: modalFormData.type,
            start_date: dateStr,
            end_date: dateStr,
            reason: modalFormData.reason || null
          }
          return VacationAPI.createVacation(vacationData)
        })

        await Promise.all(promises)

        // 휴가 데이터와 직원 데이터 모두 재로드 (남은 휴가 실시간 반영)
        await Promise.all([loadVacations(), loadEmployees()])

        // 선택된 날짜의 휴가 업데이트
        const updatedDateVacations = getVacationsForDate(selectedDate)
        setSelectedDateVacations(updatedDateVacations)

        setSelectedEmployees([])
        setModalMode('view')

        const employeeNames = selectedEmployees.map(id => {
          const emp = employees.find(emp => emp.id === id)
          return emp.name
        }).join(', ')
        alert(`${employeeNames}님의 휴가가 등록되었습니다.`)
      } catch (err) {
        console.error('휴가 등록 실패:', err)
        alert('휴가 등록에 실패했습니다.')
      }
    }
  }

  // 휴가 삭제 핸들러
  const handleDeleteVacation = async (vacationId, employeeName) => {
    if (confirm(`${employeeName}님의 휴가를 삭제하시겠습니까?`)) {
      try {
        await VacationAPI.deleteVacation(vacationId)

        // 데이터 재로드
        await Promise.all([loadVacations(), loadEmployees()])

        // 선택된 날짜의 휴가 업데이트
        const updatedDateVacations = getVacationsForDate(selectedDate)
        setSelectedDateVacations(updatedDateVacations)

        // 삭제 후 휴가가 없으면 등록 모드로 변경
        if (updatedDateVacations.length === 0) {
          setModalMode('add')
        }

        alert('휴가가 삭제되었습니다.')
      } catch (err) {
        console.error('휴가 삭제 실패:', err)
        alert('휴가 삭제에 실패했습니다.')
      }
    }
  }

  // 휴가 편집 시작
  const handleEditVacation = (vacation) => {
    setEditingVacation(vacation)
    setModalFormData({
      type: vacation.type,
      reason: vacation.reason || '',
      applyToAll: false
    })
    setModalMode('edit')
  }

  // 모달 모드 변경
  const switchModalMode = (mode) => {
    setModalMode(mode)
    setEditingVacation(null)
    setSelectedEmployees([])
    setModalFormData({
      type: '연차',
      reason: '',
      applyToAll: false
    })
  }

  // Export functions
  const exportToImage = async () => {
    if (!dashboardRef.current) return
    
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f8f9fa'
      })
      
      const link = document.createElement('a')
      link.download = `직원휴가현황_${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error('Error exporting image:', error)
      alert('이미지 내보내기 중 오류가 발생했습니다.')
    }
  }

  const exportToPDF = async () => {
    if (!dashboardRef.current) return
    
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#f8f9fa'
      })
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })
      
      const imgWidth = 287 // A4 landscape width in mm minus margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight)
      pdf.save(`직원휴가현황_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('PDF 내보내기 중 오류가 발생했습니다.')
    }
  }

  // Individual employee card export
  const exportEmployeeCard = async (employeeId, employeeName) => {
    const cardElement = document.getElementById(`employee-card-${employeeId}`)
    if (!cardElement) return
    
    try {
      const canvas = await html2canvas(cardElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: cardElement.offsetWidth,
        height: cardElement.offsetHeight
      })
      
      const link = document.createElement('a')
      link.download = `${employeeName}_휴가현황_${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (error) {
      console.error('Error exporting employee card:', error)
      alert(`${employeeName} 카드 내보내기 중 오류가 발생했습니다.`)
    }
  }

  const exportEmployeeCardToPDF = async (employeeId, employeeName) => {
    const cardElement = document.getElementById(`employee-card-${employeeId}`)
    if (!cardElement) return
    
    try {
      const canvas = await html2canvas(cardElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: cardElement.offsetWidth,
        height: cardElement.offsetHeight
      })
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })
      
      const imgWidth = 180 // A4 portrait width in mm minus margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 15, 15, imgWidth, imgHeight)
      pdf.save(`${employeeName}_휴가현황_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (error) {
      console.error('Error exporting employee card PDF:', error)
      alert(`${employeeName} 카드 PDF 내보내기 중 오류가 발생했습니다.`)
    }
  }

  // Employee management functions
  const handleEmployeeFormChange = (e) => {
    setEmployeeForm({
      ...employeeForm,
      [e.target.name]: e.target.value
    })
  }

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault()
    if (!employeeForm.name || !employeeForm.department || !employeeForm.hireDate) {
      alert('이름, 부서, 입사일을 모두 입력해주세요.')
      return
    }

    try {
      const employeeData = {
        name: employeeForm.name,
        department: employeeForm.department,
        yearly_allowance: parseInt(employeeForm.yearlyAllowance),
        hire_date: employeeForm.hireDate
      }

      await VacationAPI.createEmployee(employeeData)
      
      // 직원 데이터 재로드
      await loadEmployees()
      
      setEmployeeForm({
        name: '',
        department: '',
        yearlyAllowance: 15,
        hireDate: ''
      })
      alert(`${employeeData.name}님이 추가되었습니다.`)
    } catch (err) {
      console.error('직원 추가 실패:', err)
      alert('직원 추가에 실패했습니다.')
    }
  }

  const deleteEmployee = async (employeeId, employeeName) => {
    const employeeVacations = getEmployeeVacations(employeeId)
    const hasVacations = employeeVacations.length > 0
    
    const confirmMessage = hasVacations 
      ? `${employeeName}님을 삭제하시겠습니까?\n\n⚠️ 해당 직원의 휴가 기록 ${employeeVacations.length}건도 함께 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다.`
      : `${employeeName}님을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
    
    if (confirm(confirmMessage)) {
      try {
        await VacationAPI.deleteEmployee(employeeId)
        // 직원 데이터와 휴가 데이터 모두 재로드
        await Promise.all([loadEmployees(), loadVacations()])
        
        const deleteMessage = hasVacations 
          ? `${employeeName}님과 관련 휴가 기록 ${employeeVacations.length}건이 삭제되었습니다.`
          : `${employeeName}님이 삭제되었습니다.`
        alert(deleteMessage)
      } catch (err) {
        console.error('직원 삭제 실패:', err)
        alert('직원 삭제에 실패했습니다.')
      }
    }
  }

  // Employee edit functions
  const openEditModal = (employee) => {
    const stats = getEmployeeStats(employee)
    const isNewEmployee = !isEmployeeOverOneYear(employee.hireDate)
    
    setEditingEmployee(employee)
    setEditForm({
      name: employee.name,
      department: employee.department,
      yearlyAllowance: employee.yearlyAllowance,
      hireDate: employee.hireDate,
      // 1년미만인 경우 사용한 휴가를, 1년이상인 경우 남은 휴가를 표시
      currentRemainingDays: isNewEmployee ? stats.usedDays : (employee.currentRemainingDays || stats.remainingDays)
    })
    setShowEditModal(true)
  }

  const handleEditFormChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value
    })
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editForm.name || !editForm.department || !editForm.hireDate) {
      alert('이름, 부서, 입사일을 모두 입력해주세요.')
      return
    }

    try {
      const isNewEmployee = !isEmployeeOverOneYear(editingEmployee.hireDate)
      let finalRemainingDays = parseFloat(editForm.currentRemainingDays)
      
      // 1년미만의 경우 입력된 값을 사용한 휴가로 처리하고 남은 휴가는 음수로 계산
      if (isNewEmployee) {
        // 사용한 휴가가 입력되었으므로 남은 휴가는 0 - 사용한 휴가 = 음수
        finalRemainingDays = -parseFloat(editForm.currentRemainingDays)
      }
      // 일반 직원의 경우 그대로 남은 휴가로 처리

      const employeeData = {
        name: editForm.name,
        department: editForm.department,
        yearly_allowance: parseInt(editForm.yearlyAllowance),
        hire_date: editForm.hireDate,
        current_remaining_days: finalRemainingDays
      }

      await VacationAPI.updateEmployee(editingEmployee.id, employeeData)
      
      // 직원 데이터 재로드
      await loadEmployees()
      
      setShowEditModal(false)
      setEditingEmployee(null)
      alert(`${editForm.name}님의 정보가 수정되었습니다.`)
    } catch (err) {
      console.error('직원 정보 수정 실패:', err)
      alert('직원 정보 수정에 실패했습니다.')
    }
  }

  // 갱신 테스트 함수
  const handleRenewalTest = async () => {
    if (confirm('갱신 테스트를 실행하시겠습니까?\n\n갱신일이 지난 직원들의 휴가가 자동으로 추가됩니다.')) {
      try {
        const result = await VacationAPI.testRenewal()
        
        // 직원 데이터 새로고침
        await loadEmployees()
        
        alert(`갱신 테스트 완료!\n\n총 직원: ${result.totalEmployees}명\n갱신된 직원: ${result.renewedEmployees}명\n테스트 날짜: ${result.testDate}`)
      } catch (err) {
        console.error('갱신 테스트 실패:', err)
        alert('갱신 테스트에 실패했습니다.')
      }
    }
  }

  return (
    <div className="admin-app">
      <header>
        <h1>🏢 직원 휴가 관리 시스템 (관리자)</h1>
        <p>직원들의 휴가를 효율적으로 관리하세요</p>
      </header>

      <nav>
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => {
            setActiveTab('dashboard')
            loadEmployees()
            loadVacations()
          }}
        >
          직원 현황
        </button>
        <button 
          className={activeTab === 'calendar' ? 'active' : ''}
          onClick={() => {
            setActiveTab('calendar')
            loadEmployees()
            loadVacations()
          }}
        >
          달력 관리
        </button>
        <button 
          className={activeTab === 'register' ? 'active' : ''}
          onClick={() => {
            setActiveTab('register')
            loadEmployees()
            loadVacations()
          }}
        >
          휴가 등록
        </button>
        <button 
          className={activeTab === 'all-vacations' ? 'active' : ''}
          onClick={() => {
            setActiveTab('all-vacations')
            loadEmployees()
            loadVacations()
          }}
        >
          전체 휴가 내역
        </button>
        <button 
          className={activeTab === 'employee-management' ? 'active' : ''}
          onClick={() => {
            setActiveTab('employee-management')
            loadEmployees()
            loadVacations()
          }}
        >
          직원 관리
        </button>
      </nav>

      {loading && (
        <div className="loading-container">
          <p>데이터를 불러오는 중...</p>
        </div>
      )}
      
      {error && (
        <div className="error-container">
          <p>오류: {error}</p>
          <button onClick={() => { loadEmployees(); loadVacations(); }}>다시 시도</button>
        </div>
      )}
      
      {!loading && !error && activeTab === 'dashboard' && (
        <div className="dashboard-section" ref={dashboardRef}>
          <div className="dashboard-header">
            <h2>직원별 휴가 현황</h2>
            <div className="export-buttons">
              <button className="export-btn image-btn" onClick={exportToImage}>
                📷 전체 이미지 내보내기
              </button>
              <button className="export-btn pdf-btn" onClick={exportToPDF}>
                📄 전체 PDF 내보내기
              </button>
            </div>
          </div>
          <div className="employee-grid">
            {employees.map(employee => {
              const stats = getEmployeeStats(employee)
              const employeeVacations = getEmployeeVacations(employee.id)
              return (
                <div key={employee.id} id={`employee-card-${employee.id}`} className="employee-card">
                  <div className="employee-header">
                    <div className="employee-name-dept">
                      <h3>{employee.name}</h3>
                      <span className="department">{employee.department}</span>
                    </div>
                    <div className="card-export-buttons">
                      <button 
                        className="card-export-btn image-btn-small"
                        onClick={() => exportEmployeeCard(employee.id, employee.name)}
                        title="이미지로 내보내기"
                      >
                        📷
                      </button>
                      <button 
                        className="card-export-btn pdf-btn-small"
                        onClick={() => exportEmployeeCardToPDF(employee.id, employee.name)}
                        title="PDF로 내보내기"
                      >
                        📄
                      </button>
                    </div>
                  </div>
                  <div className="employee-status">
                    <div className="status-badge">
                      {stats.isNewEmployee ? (
                        <span className="badge new-employee">1년미만</span>
                      ) : (
                        <span className="badge regular-employee">1년이상</span>
                      )}
                    </div>
                    <div className="hire-info">
                      <span className="hire-date">입사일: {employee.hireDate}</span>
                      <span className="renewal-date">
                        갱신일: {stats.nextRenewalDate.toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="vacation-stats">
                    {stats.isNewEmployee ? (
                      <>
                        <div className="stat-item main-stat">
                          <span className="label">사용한 휴가</span>
                          <span className="value used-highlight">{stats.usedDays}일</span>
                        </div>
                        <div className="stat-item new-employee-note">
                          <span className="note">갱신일 후 정규 휴가 부여</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="stat-item main-stat">
                          <span className="label">남은 휴가</span>
                          <span className={`value remaining-highlight ${stats.remainingDays < 5 ? 'low' : ''}`}>
                            {stats.remainingDays}일
                          </span>
                        </div>
                        <div className="stat-item secondary-stat">
                          <span className="label">사용한 휴가</span>
                          <span className="value">{stats.usedDays}일</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {!stats.isNewEmployee && (
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{width: `${Math.max(0, ((employee.yearlyAllowance - stats.remainingDays) / employee.yearlyAllowance) * 100)}%`}}
                      ></div>
                    </div>
                  )}
                  <div className="recent-vacations">
                    <h4>최근 휴가</h4>
                    {employeeVacations.length === 0 ? (
                      <p className="no-vacation">휴가 내역 없음</p>
                    ) : (
                      <div className="vacation-mini-list">
                        {employeeVacations.slice(-2).map(vacation => (
                          <div key={vacation.id} className="mini-vacation-item">
                            <span className="mini-type">{vacation.type}</span>
                            <span className="mini-dates">
                              {vacation.startDate} ~ {vacation.endDate}
                            </span>
                            <span className="mini-days">
                              {calculateDays(vacation.startDate, vacation.endDate, vacation.type)}일
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && !error && activeTab === 'calendar' && (
        <div className="calendar-section">
          <h2>달력 휴가 관리</h2>
          <div className="calendar-header">
            <button 
              className="nav-btn"
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            >
              ‹
            </button>
            <h3>
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </h3>
            <button 
              className="nav-btn"
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            >
              ›
            </button>
          </div>
          
          <div className="calendar">
            <div className="weekdays">
              <div className="weekday">일</div>
              <div className="weekday">월</div>
              <div className="weekday">화</div>
              <div className="weekday">수</div>
              <div className="weekday">목</div>
              <div className="weekday">금</div>
              <div className="weekday">토</div>
            </div>
            
            <div className="calendar-grid">
              {getDaysInMonth(currentDate).map((date, index) => {
                const dateVacations = date ? getVacationsForDate(date) : []
                return (
                  <div 
                    key={index} 
                    className={`calendar-day ${
                      date ? 'clickable' : 'empty'
                    } ${
                      dateVacations.length > 0 ? 'has-vacation' : ''
                    }`}
                    onClick={() => date && handleDateClick(date)}
                  >
                    {date && (
                      <>
                        <span className="day-number">{date.getDate()}</span>
                        {dateVacations.length > 0 && (
                          <div className="vacation-indicators">
                            {dateVacations.slice(0, 3).map((vacation, i) => (
                              <div key={i} className={`vacation-dot ${vacation.type}`}>
                                {vacation.employeeName.charAt(0)}
                              </div>
                            ))}
                            {dateVacations.length > 3 && (
                              <div className="vacation-dot more">+{dateVacations.length - 3}</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Integrated Vacation Management Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content vacation-management-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                📅 {selectedDate?.toLocaleDateString('ko-KR')} 휴가 관리
              </h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            {/* Mode Toggle Buttons */}
            <div className="modal-mode-tabs">
              <button
                className={`mode-tab ${modalMode === 'view' ? 'active' : ''}`}
                onClick={() => switchModalMode('view')}
                disabled={selectedDateVacations.length === 0}
              >
                📋 조회 ({selectedDateVacations.length})
              </button>
              <button
                className={`mode-tab ${modalMode === 'add' ? 'active' : ''}`}
                onClick={() => switchModalMode('add')}
              >
                ➕ 추가
              </button>
            </div>

            {/* View Mode: Show existing vacations */}
            {modalMode === 'view' && (
              <div className="vacation-list-view">
                <h4>이 날의 휴가 현황</h4>
                {selectedDateVacations.length === 0 ? (
                  <div className="no-vacation-info">
                    <p>등록된 휴가가 없습니다.</p>
                    <button
                      className="switch-mode-btn"
                      onClick={() => switchModalMode('add')}
                    >
                      휴가 추가하기
                    </button>
                  </div>
                ) : (
                  <div className="vacation-items">
                    {selectedDateVacations.map(vacation => (
                      <div key={vacation.id} className="vacation-item-card">
                        <div className="vacation-info">
                          <div className="employee-info">
                            <span className="employee-name">{vacation.employeeName}</span>
                            <span className={`vacation-type-badge ${vacation.type}`}>
                              {vacation.type}
                            </span>
                          </div>
                          {vacation.reason && (
                            <div className="vacation-reason">
                              💭 {vacation.reason}
                            </div>
                          )}
                          <div className="vacation-duration">
                            📊 {calculateDays(vacation.startDate, vacation.endDate, vacation.type)}일
                          </div>
                        </div>
                        <div className="vacation-actions">
                          <button
                            className="edit-btn"
                            onClick={() => handleEditVacation(vacation)}
                            title="휴가 수정"
                          >
                            ✏️
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => handleDeleteVacation(vacation.id, vacation.employeeName)}
                            title="휴가 삭제"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Add Mode: Add new vacation */}
            {modalMode === 'add' && (
              <div className="vacation-add-form">
                <h4>새 휴가 추가</h4>
                <form onSubmit={handleModalSubmit}>
                  <div className="form-group">
                    <label>휴가 구분</label>
                    <select
                      value={modalFormData.type}
                      onChange={(e) => setModalFormData({...modalFormData, type: e.target.value})}
                    >
                      <option value="연차">연차</option>
                      <option value="반차">반차</option>
                      <option value="병가">병가</option>
                      <option value="경조사">경조사</option>
                      <option value="특별휴가">특별휴가</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>사유 (선택)</label>
                    <textarea
                      value={modalFormData.reason}
                      onChange={(e) => setModalFormData({...modalFormData, reason: e.target.value})}
                      placeholder="휴가 사유를 입력해주세요"
                      rows="3"
                    />
                  </div>

                  <div className="employee-selection">
                    <div className="selection-header">
                      <label>대상 직원</label>
                      <button
                        type="button"
                        className="select-all-btn"
                        onClick={handleSelectAll}
                      >
                        {selectedEmployees.length === employees.length ? '전체 해제' : '전체 선택'}
                      </button>
                    </div>

                    <div className="employee-checkboxes">
                      {employees.map(employee => (
                        <label key={employee.id} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(employee.id)}
                            onChange={() => handleEmployeeToggle(employee.id)}
                          />
                          <span>{employee.name} ({employee.department})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowModal(false)}>
                      취소
                    </button>
                    <button type="submit">
                      등록
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Edit Mode: Edit existing vacation */}
            {modalMode === 'edit' && editingVacation && (
              <div className="vacation-edit-form">
                <h4>휴가 수정 - {editingVacation.employeeName}</h4>
                <form onSubmit={handleModalSubmit}>
                  <div className="form-group">
                    <label>휴가 구분</label>
                    <select
                      value={modalFormData.type}
                      onChange={(e) => setModalFormData({...modalFormData, type: e.target.value})}
                    >
                      <option value="연차">연차</option>
                      <option value="반차">반차</option>
                      <option value="병가">병가</option>
                      <option value="경조사">경조사</option>
                      <option value="특별휴가">특별휴가</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>사유 (선택)</label>
                    <textarea
                      value={modalFormData.reason}
                      onChange={(e) => setModalFormData({...modalFormData, reason: e.target.value})}
                      placeholder="휴가 사유를 입력해주세요"
                      rows="3"
                    />
                  </div>

                  <div className="modal-actions">
                    <button type="button" onClick={() => switchModalMode('view')}>
                      취소
                    </button>
                    <button type="submit">
                      수정 완료
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && !error && activeTab === 'register' && (
        <div className="register-section">
          <h2>직원 휴가 등록</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>직원 선택</label>
                <select 
                  name="employeeId" 
                  value={formData.employeeId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">직원을 선택하세요</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} ({employee.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>휴가 구분</label>
                <select 
                  name="type" 
                  value={formData.type}
                  onChange={handleInputChange}
                >
                  <option value="연차">연차</option>
                  <option value="반차">반차</option>
                  <option value="병가">병가</option>
                  <option value="경조사">경조사</option>
                  <option value="특별휴가">특별휴가</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>시작일</label>
                <input 
                  type="date" 
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>종료일</label>
                <input 
                  type="date" 
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>사유 (선택)</label>
              <textarea 
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                placeholder="휴가 사유를 입력해주세요 (선택사항)"
              />
            </div>

            <button type="submit" className="submit-btn">휴가 등록</button>
          </form>
        </div>
      )}

      {!loading && !error && activeTab === 'all-vacations' && (
        <div className="list-section">
          <h2>전체 휴가 내역</h2>
          {vacations.length === 0 ? (
            <p className="no-data">등록된 휴가가 없습니다.</p>
          ) : (
            <div className="vacation-list">
              {vacations
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(vacation => (
                <div key={vacation.id} className="vacation-item">
                  <div className="vacation-header">
                    <div className="employee-info">
                      <span className="employee-name">{vacation.employeeName}</span>
                      <span className="vacation-type">{vacation.type}</span>
                    </div>
                    <div className="vacation-actions">
                      <span className="vacation-days">
                        {calculateDays(vacation.startDate, vacation.endDate, vacation.type)}일
                      </span>
                      <button 
                        className="delete-btn"
                        onClick={() => deleteVacation(vacation.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <div className="vacation-dates">
                    📅 {vacation.startDate} ~ {vacation.endDate}
                  </div>
                  {vacation.reason && (
                    <div className="vacation-reason">
                      💭 사유: {vacation.reason}
                    </div>
                  )}
                  <div className="created-date">
                    등록일: {new Date(vacation.createdAt).toLocaleString('ko-KR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'employee-management' && (
        <div className="employee-management-section">
          <h2>직원 관리</h2>
          
          {/* 직원 추가 폼 */}
          <div className="add-employee-form">
            <h3>새 직원 추가</h3>
            <form onSubmit={handleEmployeeSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>이름</label>
                  <input 
                    type="text" 
                    name="name"
                    value={employeeForm.name}
                    onChange={handleEmployeeFormChange}
                    placeholder="직원 이름"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>부서</label>
                  <input 
                    type="text" 
                    name="department"
                    value={employeeForm.department}
                    onChange={handleEmployeeFormChange}
                    placeholder="소속 부서"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>연간 휴가 일수</label>
                  <input 
                    type="number" 
                    name="yearlyAllowance"
                    value={employeeForm.yearlyAllowance}
                    onChange={handleEmployeeFormChange}
                    min="0"
                    max="30"
                  />
                </div>

                <div className="form-group">
                  <label>입사일</label>
                  <input 
                    type="date" 
                    name="hireDate"
                    value={employeeForm.hireDate}
                    onChange={handleEmployeeFormChange}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="submit-btn">직원 추가</button>
            </form>
          </div>

          {/* 직원 목록 */}
          <div className="employee-list-management">
            <div className="management-header">
              <h3>직원 목록 관리</h3>
              <button 
                className="test-renewal-btn"
                onClick={handleRenewalTest}
                title="갱신일이 지난 직원들의 휴가를 수동으로 갱신합니다"
              >
                🔄 갱신 테스트
              </button>
            </div>
            {employees.length === 0 ? (
              <p className="no-data">등록된 직원이 없습니다.</p>
            ) : (
              <div className="employee-management-grid">
                {employees.map(employee => {
                  const stats = getEmployeeStats(employee)
                  const employeeVacations = getEmployeeVacations(employee.id)
                  return (
                    <div key={employee.id} className="employee-management-card">
                      <div className="employee-info">
                        <div className="employee-header">
                          <h4>{employee.name}</h4>
                          <span className="department">{employee.department}</span>
                        </div>
                        
                        <div className="employee-details">
                          <div className="detail-item">
                            <span className="label">입사일:</span>
                            <span className="value">{employee.hireDate}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">연간 휴가:</span>
                            <span className="value">{employee.yearlyAllowance}일</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">사용 휴가:</span>
                            <span className="value">{stats.usedDays}일</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">남은 휴가:</span>
                            <span className="value">{stats.isNewEmployee ? '1년미만' : `${stats.remainingDays}일`}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">휴가 기록:</span>
                            <span className="value">{employeeVacations.length}건</span>
                          </div>
                        </div>
                      </div>

                      <div className="employee-actions">
                        <button 
                          className="edit-employee-btn"
                          onClick={() => openEditModal(employee)}
                          title="직원 정보 수정"
                        >
                          수정
                        </button>
                        <button 
                          className="delete-employee-btn"
                          onClick={() => deleteEmployee(employee.id, employee.name)}
                          title={employeeVacations.length > 0 ? `직원과 휴가 기록 ${employeeVacations.length}건을 함께 삭제합니다` : '직원 삭제'}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Employee Edit Modal */}
      {showEditModal && editingEmployee && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content edit-employee-modal" onClick={(e) => e.stopPropagation()}>
            <h3>직원 정보 수정 - {editingEmployee.name}</h3>
            
            <form onSubmit={handleEditSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>이름</label>
                  <input 
                    type="text" 
                    name="name"
                    value={editForm.name}
                    onChange={handleEditFormChange}
                    placeholder="직원 이름"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>부서</label>
                  <input 
                    type="text" 
                    name="department"
                    value={editForm.department}
                    onChange={handleEditFormChange}
                    placeholder="소속 부서"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>연간 휴가 일수</label>
                  <input 
                    type="number" 
                    name="yearlyAllowance"
                    value={editForm.yearlyAllowance}
                    onChange={handleEditFormChange}
                    min="0"
                    max="30"
                  />
                </div>

                <div className="form-group">
                  <label>입사일</label>
                  <input 
                    type="date" 
                    name="hireDate"
                    value={editForm.hireDate}
                    onChange={handleEditFormChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    {editingEmployee && !isEmployeeOverOneYear(editingEmployee.hireDate) ? '사용한 휴가 일수' : '현재 남은 휴가 일수'}
                  </label>
                  <input 
                    type="number" 
                    name="currentRemainingDays"
                    value={editForm.currentRemainingDays}
                    onChange={handleEditFormChange}
                    step="0.5"
                  />
                  <small className="form-help">
                    {editingEmployee && !isEmployeeOverOneYear(editingEmployee.hireDate) 
                      ? '1년미만 직원은 사용한 휴가 일수를 입력하세요.'
                      : '직접 수정 가능합니다. 자동 계산값을 무시하고 이 값이 사용됩니다.'
                    }
                  </small>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowEditModal(false)}>
                  취소
                </button>
                <button type="submit">
                  수정 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
