const { 
    createDomainFolder, 
    switchDomainTemplate, 
    getAvailableTemplates, 
    listDomains,
    getDomainInfo,
    getDomainLayout
} = require('../backend/services/domain/staticGen');

async function demoTemplateSystem() {
    console.log('🚀 Astro Template System Demo\n');
    
    try {
        // 1. Show available templates
        console.log('📋 Available Templates:');
        const templates = await getAvailableTemplates();
        templates.forEach(template => {
            console.log(`  - ${template}`);
        });
        console.log('');
        
        // 2. Create a new domain
        console.log('🏗️  Creating domain "my-website"...');
        const domainPath = await createDomainFolder('my-website');
        console.log('');
        
        // 3. Show domain info
        console.log('📊 Domain Information:');
        const domainInfo = await getDomainInfo('my-website');
        console.log(JSON.stringify(domainInfo, null, 2));
        console.log('');
        
        // 4. Show current layout
        console.log('🎨 Current Layout:');
        const currentLayout = await getDomainLayout('my-website');
        console.log(`  - ${currentLayout}`);
        console.log('');
        
        // 5. List all domains
        console.log('📋 All Domains:');
        const allDomains = await listDomains();
        allDomains.forEach(domain => {
            console.log(`  - ${domain.domainName} (${domain.layout})`);
        });
        console.log('');
        
        console.log('🎉 Demo completed successfully!');
        console.log('\nTo test the domain:');
        console.log('1. Navigate to the created domain folder');
        console.log('2. Run: npm install');
        console.log('3. Run: npm run dev');
        console.log('4. Visit http://localhost:4321 to see your site!');
        console.log('\nTo switch layouts:');
        console.log('- Use switchDomainTemplate("my-website", "NewLayoutName")');
        console.log('- Or manually edit src/layout-config.json');
        
    } catch (error) {
        console.error('❌ Error during demo:', error.message);
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    demoTemplateSystem();
}

module.exports = { demoTemplateSystem }; 