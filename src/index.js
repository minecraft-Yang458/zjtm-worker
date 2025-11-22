import { 
    createResponse, 
    errorResponse, 
    successResponse, 
    validateAdminAuth,
    generateId,
    getKVData,
    setKVData,
    validateModData
} from './utils.js';

// 主处理函数
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        // 处理预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Auth'
                }
            });
        }
        
        // API路由
        if (path.startsWith('/api/')) {
            return handleAPI(request, env, path);
        }
        
        // 默认响应
        return createResponse({ 
            message: '筑界同盟 API 服务',
            version: '1.0.0'
        });
    }
};

// 处理API请求
async function handleAPI(request, env, path) {
    try {
        // 公开API路由
        if (path === '/api/stats') {
            return await getStats(env);
        }
        
        if (path === '/api/mods') {
            return await getMods(request, env);
        }
        
        if (path.match(/^\/api\/mods\/[^\/]+\/download$/)) {
            const modId = path.split('/')[3];
            return await recordDownload(env, modId);
        }
        
        // 管理API路由 - 需要验证
        if (path.startsWith('/api/admin/')) {
            if (!validateAdminAuth(request)) {
                return errorResponse('未授权访问', 401);
            }
            
            if (path === '/api/admin/stats') {
                return await getAdminStats(env);
            }
            
            if (path === '/api/admin/mods') {
                return await handleModsManagement(request, env);
            }
            
            if (path.match(/^\/api\/admin\/mods\/[^\/]+$/)) {
                const modId = path.split('/')[4];
                return await handleModManagement(request, env, modId);
            }
            
            if (path === '/api/admin/upload') {
                return await handleImageUpload(request, env);
            }
            
            if (path === '/api/admin/images') {
                return await getImages(env);
            }
            
            if (path.match(/^\/api\/admin\/images\/[^\/]+$/)) {
                const imageId = path.split('/')[4];
                return await deleteImage(env, imageId);
            }
            
            if (path === '/api/admin/activities') {
                return await getActivities(env);
            }
        }
        
        return errorResponse('接口不存在', 404);
    } catch (error) {
        console.error('API处理错误:', error);
        return errorResponse('服务器内部错误', 500);
    }
}

// 获取统计数据
async function getStats(env) {
    const mods = await getKVData(env.MODS_STORE, 'mods') || [];
    const stats = await getKVData(env.MODS_STORE, 'stats') || {
        totalDownloads: 0,
        todayDownloads: 0,
        lastReset: new Date().toDateString()
    };
    
    // 检查是否需要重置今日下载量
    const today = new Date().toDateString();
    if (stats.lastReset !== today) {
        stats.todayDownloads = 0;
        stats.lastReset = today;
        await setKVData(env.MODS_STORE, 'stats', stats);
    }
    
    return successResponse({
        totalMods: mods.length,
        totalDownloads: stats.totalDownloads,
        todayDownloads: stats.todayDownloads
    });
}

// 获取模组列表
async function getMods(request, env) {
    const url = new URL(request.url);
    const featured = url.searchParams.get('featured') === 'true';
    
    let mods = await getKVData(env.MODS_STORE, 'mods') || [];
    
    // 应用筛选
    if (featured) {
        mods = mods.filter(mod => mod.featured);
    }
    
    return successResponse({ mods });
}

// 记录下载
async function recordDownload(env, modId) {
    let mods = await getKVData(env.MODS_STORE, 'mods') || [];
    let stats = await getKVData(env.MODS_STORE, 'stats') || {
        totalDownloads: 0,
        todayDownloads: 0,
        lastReset: new Date().toDateString()
    };
    
    // 检查是否需要重置今日下载量
    const today = new Date().toDateString();
    if (stats.lastReset !== today) {
        stats.todayDownloads = 0;
        stats.lastReset = today;
    }
    
    // 更新模组下载量
    const modIndex = mods.findIndex(mod => mod.id === modId);
    if (modIndex !== -1) {
        mods[modIndex].downloads = (mods[modIndex].downloads || 0) + 1;
        await setKVData(env.MODS_STORE, 'mods', mods);
    }
    
    // 更新统计数据
    stats.totalDownloads += 1;
    stats.todayDownloads += 1;
    await setKVData(env.MODS_STORE, 'stats', stats);
    
    // 记录活动
    await recordActivity(env, 'download', `模组下载: ${modId}`);
    
    return successResponse({ 
        message: '下载记录成功',
        downloadUrl: mods[modIndex]?.downloadUrl || '#' 
    });
}

// 获取管理统计数据
async function getAdminStats(env) {
    const mods = await getKVData(env.MODS_STORE, 'mods') || [];
    const stats = await getKVData(env.MODS_STORE, 'stats') || {
        totalDownloads: 0,
        todayDownloads: 0,
        lastReset: new Date().toDateString()
    };
    
    // 检查是否需要重置今日下载量
    const today = new Date().toDateString();
    if (stats.lastReset !== today) {
        stats.todayDownloads = 0;
        stats.lastReset = today;
        await setKVData(env.MODS_STORE, 'stats', stats);
    }
    
    return successResponse({
        totalMods: mods.length,
        totalDownloads: stats.totalDownloads,
        todayDownloads: stats.todayDownloads
    });
}

// 处理模组管理
async function handleModsManagement(request, env) {
    if (request.method === 'GET') {
        const mods = await getKVData(env.MODS_STORE, 'mods') || [];
        return successResponse({ mods });
    }
    
    if (request.method === 'POST') {
        const modData = await request.json();
        
        // 验证数据
        const validationError = validateModData(modData);
        if (validationError) {
            return errorResponse(validationError);
        }
        
        let mods = await getKVData(env.MODS_STORE, 'mods') || [];
        
        // 创建新模组
        const newMod = {
            id: generateId(),
            name: modData.name,
            description: modData.description,
            version: modData.version,
            downloadUrl: modData.downloadUrl,
            image: modData.image || '',
            featured: modData.featured || false,
            downloads: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        mods.push(newMod);
        await setKVData(env.MODS_STORE, 'mods', mods);
        
        // 记录活动
        await recordActivity(env, 'create', `创建模组: ${modData.name}`);
        
        return successResponse({ mod: newMod }, '模组创建成功');
    }
    
    return errorResponse('方法不允许', 405);
}

// 处理单个模组管理
async function handleModManagement(request, env, modId) {
    let mods = await getKVData(env.MODS_STORE, 'mods') || [];
    const modIndex = mods.findIndex(mod => mod.id === modId);
    
    if (modIndex === -1) {
        return errorResponse('模组不存在', 404);
    }
    
    if (request.method === 'PUT') {
        const modData = await request.json();
        
        // 验证数据
        const validationError = validateModData(modData);
        if (validationError) {
            return errorResponse(validationError);
        }
        
        // 更新模组
        mods[modIndex] = {
            ...mods[modIndex],
            name: modData.name,
            description: modData.description,
            version: modData.version,
            downloadUrl: modData.downloadUrl,
            image: modData.image || '',
            featured: modData.featured || false,
            updatedAt: new Date().toISOString()
        };
        
        await setKVData(env.MODS_STORE, 'mods', mods);
        
        // 记录活动
        await recordActivity(env, 'update', `更新模组: ${modData.name}`);
        
        return successResponse({ mod: mods[modIndex] }, '模组更新成功');
    }
    
    if (request.method === 'DELETE') {
        const deletedMod = mods[modIndex];
        mods.splice(modIndex, 1);
        await setKVData(env.MODS_STORE, 'mods', mods);
        
        // 记录活动
        await recordActivity(env, 'delete', `删除模组: ${deletedMod.name}`);
        
        return successResponse(null, '模组删除成功');
    }
    
    return errorResponse('方法不允许', 405);
}

// 处理图片上传
async function handleImageUpload(request, env) {
    if (request.method !== 'POST') {
        return errorResponse('方法不允许', 405);
    }
    
    // 在实际项目中，这里应该处理文件上传
    // 这里简化处理，只保存图片信息
    
    const formData = await request.formData();
    const imageFile = formData.get('image');
    
    if (!imageFile) {
        return errorResponse('没有上传文件');
    }
    
    // 简化处理：在实际项目中，这里应该将文件上传到R2或其它存储服务
    const imageId = generateId();
    const imageName = imageFile.name || `image-${imageId}`;
    
    let images = await getKVData(env.IMAGES_STORE, 'images') || [];
    
    const newImage = {
        id: imageId,
        name: imageName,
        url: `https://example.com/images/${imageId}`, // 简化URL
        size: 0, // 简化大小
        uploadedAt: new Date().toISOString()
    };
    
    images.push(newImage);
    await setKVData(env.IMAGES_STORE, 'images', images);
    
    // 记录活动
    await recordActivity(env, 'upload', `上传图片: ${imageName}`);
    
    return successResponse({ image: newImage }, '图片上传成功');
}

// 获取图片列表
async function getImages(env) {
    const images = await getKVData(env.IMAGES_STORE, 'images') || [];
    return successResponse({ images });
}

// 删除图片
async function deleteImage(env, imageId) {
    let images = await getKVData(env.IMAGES_STORE, 'images') || [];
    const imageIndex = images.findIndex(img => img.id === imageId);
    
    if (imageIndex === -1) {
        return errorResponse('图片不存在', 404);
    }
    
    const deletedImage = images[imageIndex];
    images.splice(imageIndex, 1);
    await setKVData(env.IMAGES_STORE, 'images', images);
    
    // 记录活动
    await recordActivity(env, 'delete', `删除图片: ${deletedImage.name}`);
    
    return successResponse(null, '图片删除成功');
}

// 获取活动记录
async function getActivities(env) {
    const activities = await getKVData(env.MODS_STORE, 'activities') || [];
    return successResponse({ activities: activities.slice(0, 10) }); // 返回最近10条
}

// 记录活动
async function recordActivity(env, action, details) {
    let activities = await getKVData(env.MODS_STORE, 'activities') || [];
    
    activities.unshift({
        id: generateId(),
        action,
        details,
        timestamp: new Date().toISOString()
    });
    
    // 只保留最近100条活动记录
    if (activities.length > 100) {
        activities = activities.slice(0, 100);
    }
    
    await setKVData(env.MODS_STORE, 'activities', activities);
}
