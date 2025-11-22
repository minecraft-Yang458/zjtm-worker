// 工具函数

// 生成响应
export function createResponse(data, status = 200, headers = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Auth'
    };
    
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...defaultHeaders, ...headers }
    });
}

// 错误响应
export function errorResponse(message, status = 400) {
    return createResponse({ success: false, error: message }, status);
}

// 成功响应
export function successResponse(data = null, message = '操作成功') {
    return createResponse({ success: true, message, ...(data && { data }) });
}

// 验证管理员权限
export function validateAdminAuth(request) {
    const adminToken = request.headers.get('X-Admin-Auth');
    // 在实际项目中，这里应该使用更安全的验证方式
    return adminToken === 'true'; // 简化验证，实际应使用JWT等
}

// 生成ID
export function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// 从KV获取数据
export async function getKVData(kv, key) {
    try {
        const data = await kv.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`从KV获取数据失败 (key: ${key}):`, error);
        return null;
    }
}

// 保存数据到KV
export async function setKVData(kv, key, data) {
    try {
        await kv.put(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error(`保存数据到KV失败 (key: ${key}):`, error);
        return false;
    }
}

// 验证模组数据
export function validateModData(modData) {
    const { name, description, version, downloadUrl } = modData;
    
    if (!name || name.trim().length === 0) {
        return '模组名称不能为空';
    }
    
    if (!description || description.trim().length === 0) {
        return '模组描述不能为空';
    }
    
    if (!version || version.trim().length === 0) {
        return '模组版本不能为空';
    }
    
    if (!downloadUrl || downloadUrl.trim().length === 0) {
        return '下载链接不能为空';
    }
    
    return null;
}
