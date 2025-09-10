export default {
  async scheduled(event, env, ctx) {
    // 매일 자정에 실행되는 Cron Job - 휴가 자동 갱신
    console.log('Running vacation renewal check...')
    
    try {
      // 갱신일이 된 직원들 조회
      const today = new Date().toISOString().split('T')[0]
      
      const { results: employees } = await env.DB.prepare(`
        SELECT * FROM employees 
        WHERE (
          last_renewal_date IS NULL 
          OR date(last_renewal_date, '+1 year') <= date(?)
        )
        AND date(hire_date, '+1 month') <= date(?)
      `).bind(today, today).all()

      console.log(`Found ${employees.length} employees for renewal`)

      // 각 직원의 휴가 갱신 처리
      for (const employee of employees) {
        const hireDate = new Date(employee.hire_date)
        const renewalMonth = hireDate.getMonth() + 1 // 다음달
        const renewalDay = hireDate.getDate()
        
        // 올해 갱신일 계산
        const currentYear = new Date().getFullYear()
        let renewalDate = new Date(currentYear, renewalMonth > 11 ? 0 : renewalMonth, renewalDay)
        if (renewalMonth > 11) renewalDate.setFullYear(currentYear + 1)
        
        const renewalDateStr = renewalDate.toISOString().split('T')[0]
        
        // 갱신일이 오늘이거나 지났는지 확인
        if (renewalDateStr <= today) {
          // 현재 남은 휴가에 연간 휴가 일수 추가
          const newRemainingDays = (employee.current_remaining_days || 0) + employee.yearly_allowance
          
          // 마지막 갱신일과 남은 휴가 일수 업데이트
          await env.DB.prepare(`
            UPDATE employees 
            SET last_renewal_date = ?, current_remaining_days = ?
            WHERE id = ?
          `).bind(today, newRemainingDays, employee.id).run()
          
          console.log(`Renewed vacation for employee: ${employee.name} - Added ${employee.yearly_allowance} days, Total: ${newRemainingDays} days`)
        }
      }
      
      console.log('Vacation renewal check completed')
    } catch (error) {
      console.error('Error in vacation renewal:', error)
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS 헤더 설정
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // OPTIONS 요청 (CORS preflight) 처리
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 직원 목록 조회
      if (path === '/api/employees' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT * FROM employees ORDER BY id'
        ).all();
        
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // 휴가 목록 조회
      if (path === '/api/vacations' && request.method === 'GET') {
        const { results } = await env.DB.prepare(`
          SELECT v.*, e.name as employee_name 
          FROM vacations v 
          JOIN employees e ON v.employee_id = e.id 
          ORDER BY v.created_at DESC
        `).all();
        
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // 휴가 등록
      if (path === '/api/vacations' && request.method === 'POST') {
        const data = await request.json();
        const { employee_id, type, start_date, end_date, reason } = data;

        const result = await env.DB.prepare(`
          INSERT INTO vacations (employee_id, type, start_date, end_date, reason)
          VALUES (?, ?, ?, ?, ?)
        `).bind(employee_id, type, start_date, end_date, reason || null).run();

        if (result.success) {
          // 사용한 휴가 일수 계산
          const startDate = new Date(start_date);
          const endDate = new Date(end_date);
          const diffTime = Math.abs(endDate - startDate);
          let usedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          
          // 반차는 0.5일로 계산
          if (type === '반차') {
            usedDays = usedDays * 0.5;
          }

          // 직원의 현재 남은 휴가에서 사용 일수 차감
          await env.DB.prepare(`
            UPDATE employees 
            SET current_remaining_days = COALESCE(current_remaining_days, 0) - ?
            WHERE id = ?
          `).bind(usedDays, employee_id).run();

          return new Response(JSON.stringify({ 
            success: true, 
            id: result.meta.last_row_id 
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } else {
          throw new Error('휴가 등록에 실패했습니다.');
        }
      }

      // 휴가 삭제
      if (path.startsWith('/api/vacations/') && request.method === 'DELETE') {
        const vacationId = path.split('/')[3];
        
        // 삭제할 휴가 정보 조회
        const { results: vacations } = await env.DB.prepare(
          'SELECT * FROM vacations WHERE id = ?'
        ).bind(vacationId).all();

        if (vacations.length === 0) {
          return new Response(JSON.stringify({ error: '휴가를 찾을 수 없습니다.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const vacation = vacations[0];
        
        const result = await env.DB.prepare(
          'DELETE FROM vacations WHERE id = ?'
        ).bind(vacationId).run();

        if (result.success) {
          // 삭제된 휴가 일수 계산
          const startDate = new Date(vacation.start_date);
          const endDate = new Date(vacation.end_date);
          const diffTime = Math.abs(endDate - startDate);
          let usedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          
          // 반차는 0.5일로 계산
          if (vacation.type === '반차') {
            usedDays = usedDays * 0.5;
          }

          // 직원의 현재 남은 휴가에 삭제된 일수 복원
          await env.DB.prepare(`
            UPDATE employees 
            SET current_remaining_days = COALESCE(current_remaining_days, 0) + ?
            WHERE id = ?
          `).bind(usedDays, vacation.employee_id).run();

          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } else {
          throw new Error('휴가 삭제에 실패했습니다.');
        }
      }

      // 직원 추가
      if (path === '/api/employees' && request.method === 'POST') {
        const data = await request.json();
        const { name, department, yearly_allowance, hire_date } = data;

        const result = await env.DB.prepare(`
          INSERT INTO employees (name, department, yearly_allowance, hire_date)
          VALUES (?, ?, ?, ?)
        `).bind(name, department, yearly_allowance || 15, hire_date).run();

        if (result.success) {
          return new Response(JSON.stringify({ 
            success: true, 
            id: result.meta.last_row_id 
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } else {
          throw new Error('직원 추가에 실패했습니다.');
        }
      }

      // 직원 정보 수정
      if (path.startsWith('/api/employees/') && !path.endsWith('/vacations') && request.method === 'PUT') {
        const employeeId = path.split('/')[3];
        const data = await request.json();
        const { name, department, yearly_allowance, hire_date, current_remaining_days } = data;

        const result = await env.DB.prepare(`
          UPDATE employees 
          SET name = ?, department = ?, yearly_allowance = ?, hire_date = ?, current_remaining_days = ?
          WHERE id = ?
        `).bind(name, department, yearly_allowance, hire_date, current_remaining_days, employeeId).run();

        if (result.success) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } else {
          throw new Error('직원 정보 수정에 실패했습니다.');
        }
      }

      // 직원 삭제
      if (path.startsWith('/api/employees/') && !path.endsWith('/vacations') && request.method === 'DELETE') {
        const employeeId = path.split('/')[3];
        
        // 먼저 해당 직원의 모든 휴가 기록 삭제
        await env.DB.prepare(
          'DELETE FROM vacations WHERE employee_id = ?'
        ).bind(employeeId).run();

        // 그 다음 직원 삭제
        const result = await env.DB.prepare(
          'DELETE FROM employees WHERE id = ?'
        ).bind(employeeId).run();

        if (result.success) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } else {
          throw new Error('직원 삭제에 실패했습니다.');
        }
      }

      // 특정 직원의 휴가 조회
      if (path.startsWith('/api/employees/') && path.endsWith('/vacations') && request.method === 'GET') {
        const employeeId = path.split('/')[3];
        
        const { results } = await env.DB.prepare(`
          SELECT * FROM vacations 
          WHERE employee_id = ? 
          ORDER BY start_date DESC
        `).bind(employeeId).all();
        
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      // 수동 갱신 테스트 (개발용)
      if (path === '/api/test/renewal' && request.method === 'POST') {
        console.log('Manual renewal test triggered...')
        
        try {
          // 기존 scheduled 함수의 갱신 로직을 그대로 실행
          const today = new Date().toISOString().split('T')[0]
          
          const { results: employees } = await env.DB.prepare(`
            SELECT * FROM employees 
            WHERE (
              last_renewal_date IS NULL 
              OR date(last_renewal_date, '+1 year') <= date(?)
            )
            AND date(hire_date, '+1 month') <= date(?)
          `).bind(today, today).all()

          console.log(`Found ${employees.length} employees for renewal`)
          let renewedCount = 0

          // 각 직원의 휴가 갱신 처리
          for (const employee of employees) {
            const hireDate = new Date(employee.hire_date)
            const renewalMonth = hireDate.getMonth() + 1 // 다음달
            const renewalDay = hireDate.getDate()
            
            // 올해 갱신일 계산
            const currentYear = new Date().getFullYear()
            let renewalDate = new Date(currentYear, renewalMonth > 11 ? 0 : renewalMonth, renewalDay)
            if (renewalMonth > 11) renewalDate.setFullYear(currentYear + 1)
            
            const renewalDateStr = renewalDate.toISOString().split('T')[0]
            
            // 갱신일이 오늘이거나 지났는지 확인
            if (renewalDateStr <= today) {
              // 현재 남은 휴가에 연간 휴가 일수 추가
              const newRemainingDays = (employee.current_remaining_days || 0) + employee.yearly_allowance
              
              // 마지막 갱신일과 남은 휴가 일수 업데이트
              await env.DB.prepare(`
                UPDATE employees 
                SET last_renewal_date = ?, current_remaining_days = ?
                WHERE id = ?
              `).bind(today, newRemainingDays, employee.id).run()
              
              console.log(`Renewed vacation for employee: ${employee.name} - Added ${employee.yearly_allowance} days, Total: ${newRemainingDays} days`)
              renewedCount++
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: `갱신 테스트 완료`,
            totalEmployees: employees.length,
            renewedEmployees: renewedCount,
            testDate: today
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
          
        } catch (error) {
          console.error('Manual renewal test error:', error)
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      // 404 처리
      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({ 
        error: error.message || '서버 오류가 발생했습니다.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  },
};