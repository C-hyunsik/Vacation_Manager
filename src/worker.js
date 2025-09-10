export default {
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
        
        const result = await env.DB.prepare(
          'DELETE FROM vacations WHERE id = ?'
        ).bind(vacationId).run();

        if (result.success) {
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

      // 직원 삭제
      if (path.startsWith('/api/employees/') && !path.endsWith('/vacations') && request.method === 'DELETE') {
        const employeeId = path.split('/')[3];
        
        // 먼저 해당 직원의 휴가 기록이 있는지 확인
        const { results: vacations } = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM vacations WHERE employee_id = ?'
        ).bind(employeeId).all();

        if (vacations[0].count > 0) {
          return new Response(JSON.stringify({ 
            error: '해당 직원에게 휴가 기록이 있어 삭제할 수 없습니다. 먼저 휴가 기록을 삭제해주세요.' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

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