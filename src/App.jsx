import { useState, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import './App.css'

function App() {
  const [employees] = useState([
    { id: 1, name: '김철수', department: '개발팀', yearlyAllowance: 15 },
    { id: 2, name: '이영희', department: '마케팅팀', yearlyAllowance: 15 },
    { id: 3, name: '박민수', department: '인사팀', yearlyAllowance: 15 },
    { id: 4, name: '정수진', department: '디자인팀', yearlyAllowance: 15 },
    { id: 5, name: '최우진', department: '개발팀', yearlyAllowance: 15 }
  ])

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
  const dashboardRef = useRef(null)

  const getEmployeeVacations = (employeeId) => {
    return vacations.filter(vacation => vacation.employeeId === employeeId)
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
    const remainingDays = employee.yearlyAllowance - usedDays
    return { usedDays, remainingDays }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.employeeId || !formData.startDate || !formData.endDate) {
      alert('직원, 시작일, 종료일을 모두 선택해주세요.')
      return
    }

    const employee = employees.find(emp => emp.id === parseInt(formData.employeeId))
    const newVacation = {
      id: Date.now(),
      employeeId: parseInt(formData.employeeId),
      employeeName: employee.name,
      type: formData.type,
      startDate: formData.startDate,
      endDate: formData.endDate,
      reason: formData.reason,
      createdAt: new Date().toISOString()
    }

    setVacations([...vacations, newVacation])
    setFormData({
      employeeId: '',
      type: '연차',
      startDate: '',
      endDate: '',
      reason: ''
    })
    alert(`${employee.name}님의 휴가가 등록되었습니다.`)
  }

  const deleteVacation = (id) => {
    if (confirm('휴가를 삭제하시겠습니까?')) {
      setVacations(vacations.filter(vacation => vacation.id !== id))
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
    setSelectedDate(date)
    setShowModal(true)
    setModalFormData({
      type: '연차',
      reason: '',
      applyToAll: false
    })
    setSelectedEmployees([])
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

  const handleModalSubmit = (e) => {
    e.preventDefault()
    
    if (selectedEmployees.length === 0) {
      alert('직원을 선택해주세요.')
      return
    }

    const dateStr = selectedDate.toISOString().split('T')[0]
    const newVacations = selectedEmployees.map(employeeId => {
      const employee = employees.find(emp => emp.id === employeeId)
      return {
        id: Date.now() + Math.random(),
        employeeId: employeeId,
        employeeName: employee.name,
        type: modalFormData.type,
        startDate: dateStr,
        endDate: dateStr,
        reason: modalFormData.reason,
        createdAt: new Date().toISOString()
      }
    })

    setVacations([...vacations, ...newVacations])
    setShowModal(false)
    setSelectedDate(null)
    setSelectedEmployees([])
    
    const employeeNames = newVacations.map(v => v.employeeName).join(', ')
    alert(`${employeeNames}님의 휴가가 등록되었습니다.`)
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

  return (
    <div className="admin-app">
      <header>
        <h1>🏢 직원 휴가 관리 시스템 (관리자)</h1>
        <p>직원들의 휴가를 효율적으로 관리하세요</p>
      </header>

      <nav>
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          직원 현황
        </button>
        <button 
          className={activeTab === 'calendar' ? 'active' : ''}
          onClick={() => setActiveTab('calendar')}
        >
          달력 관리
        </button>
        <button 
          className={activeTab === 'register' ? 'active' : ''}
          onClick={() => setActiveTab('register')}
        >
          휴가 등록
        </button>
        <button 
          className={activeTab === 'all-vacations' ? 'active' : ''}
          onClick={() => setActiveTab('all-vacations')}
        >
          전체 휴가 내역
        </button>
      </nav>

      {activeTab === 'dashboard' && (
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
                  <div className="vacation-stats">
                    <div className="stat-item">
                      <span className="label">연간 휴가</span>
                      <span className="value">{employee.yearlyAllowance}일</span>
                    </div>
                    <div className="stat-item">
                      <span className="label">사용</span>
                      <span className="value used">{stats.usedDays}일</span>
                    </div>
                    <div className="stat-item">
                      <span className="label">남은</span>
                      <span className={`value ${stats.remainingDays < 5 ? 'low' : 'remaining'}`}>
                        {stats.remainingDays}일
                      </span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{width: `${(stats.usedDays / employee.yearlyAllowance) * 100}%`}}
                    ></div>
                  </div>
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

      {activeTab === 'calendar' && (
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

      {/* Vacation Registration Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              {selectedDate?.toLocaleDateString('ko-KR')} 휴가 등록
            </h3>
            
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
        </div>
      )}

      {activeTab === 'register' && (
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

      {activeTab === 'all-vacations' && (
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
    </div>
  )
}

export default App
