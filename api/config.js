
const MenuAssignMaster = require('../modal/menuassignmaster');
const ModuleMaster = require('../modal/modulemaster');
const MenuMaster = require('../modal/menumaster');
const User = require('../modal/user');

exports.getConfig = async (req, res, next) => {
    try {
        // Get all menu assignments
        const menuAssignments = await MenuAssignMaster.find({ status: 1 });
        
        // Get all modules
        const modules = await ModuleMaster.find({ status: 1 });
        
        // Get all menus
        const menus = await MenuMaster.find({ status: 1 });

        // Create module-wise menu structure
        const moduleWiseMenus = modules.map(module => {
            // Find menu assignments for this module
            const moduleMenuAssignments = menuAssignments.filter(
                assignment => assignment.moduleid.toString() === module._id.toString()
            );

            // Get menu details for assigned menus
            const assignedMenus = moduleMenuAssignments.map(assignment => {
                const menuDetail = menus.find(
                    menu => menu._id.toString() === assignment.menuid.toString()
                );
                
                if (menuDetail) {
                    return {
                        _id: menuDetail._id,
                        menuname: menuDetail.menuname,
                        pagename: menuDetail.pagename,
                        aliasname: menuDetail.aliasname,
                        icon: menuDetail.icon,
                        iconid: menuDetail.iconid,
                        bgcolor: menuDetail.bgcolor,
                        showinsidebar: menuDetail.showinsidebar,
                        status: menuDetail.status,
                        recordinfo: menuDetail.recordinfo
                    };
                }
                return null;
            }).filter(menu => menu !== null);

            return {
                _id: module._id,
                module: module.module,
                iconid: module.iconid,
                icon: module.icon,
                bgcolor: module.bgcolor,
                status: module.status,
                recordinfo: module.recordinfo,
                menus: assignedMenus
            };
        });

        // Prepare response data
        const responseData = {
            modules: moduleWiseMenus,
            allMenus: menus,
            allModules: modules
        };

        // Check if email is provided in payload (only for POST requests)
        if (req.method === 'POST' && req.body) {
            const { email } = req.body;
            
            if (email) {
                // Find user by email (no password required)
                const user = await User.findOne({ email });

                if (user) {
                    // Add user data to response
                    responseData.user = {
                        id: user._id,
                        username: user.username,
                        email: user.email,
                        firstName: user.firstName,
                        firstname: user.firstname,
                        role: user.role,
                        roleid: user.roleid,
                        usercode: user.usercode,
                        is2FAEnabled: user.twofactorenabled || false,
                        status: user.status
                    };
                }
            }
        } else if (req.user && req.user.id) {
            // If user is authenticated via token, add user data
            const user = await User.findById(req.user.id);
            if (user) {
                responseData.user = {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    firstName: user.firstName,
                    firstname: user.firstname,
                    role: user.role,
                    roleid: user.roleid,
                    usercode: user.usercode,
                    is2FAEnabled: user.twofactorenabled || false,
                    status: user.status
                };
            }
        }

        res.status(200).json({ 
            success: true, 
            data: responseData
        });
    } catch (error) {
        console.error('Error fetching config:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};
