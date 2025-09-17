const API_BASE_URL = 'https://vacation-manager-api.gustlr887-f95.workers.dev';

class VacationAPI {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // 직원 목록 조회
  async getEmployees() {
    return this.request('/api/employees');
  }

  // 휴가 목록 조회
  async getVacations() {
    return this.request('/api/vacations');
  }

  // 특정 직원의 휴가 조회
  async getEmployeeVacations(employeeId) {
    return this.request(`/api/employees/${employeeId}/vacations`);
  }

  // 휴가 등록
  async createVacation(vacationData) {
    return this.request('/api/vacations', {
      method: 'POST',
      body: JSON.stringify(vacationData),
    });
  }

  // 휴가 수정
  async updateVacation(vacationId, vacationData) {
    return this.request(`/api/vacations/${vacationId}`, {
      method: 'PUT',
      body: JSON.stringify(vacationData),
    });
  }

  // 휴가 삭제
  async deleteVacation(vacationId) {
    return this.request(`/api/vacations/${vacationId}`, {
      method: 'DELETE',
    });
  }

  // 직원 추가
  async createEmployee(employeeData) {
    return this.request('/api/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
  }

  // 직원 정보 수정
  async updateEmployee(employeeId, employeeData) {
    return this.request(`/api/employees/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    });
  }

  // 직원 삭제
  async deleteEmployee(employeeId) {
    return this.request(`/api/employees/${employeeId}`, {
      method: 'DELETE',
    });
  }

  // 갱신 테스트 (개발용)
  async testRenewal() {
    return this.request('/api/test/renewal', {
      method: 'POST',
    });
  }
}

export default new VacationAPI();