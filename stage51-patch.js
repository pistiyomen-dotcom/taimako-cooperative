const fs=require('fs');
const p='www/sw.js';
let s=fs.readFileSync(p,'utf8');
s=s.replace(/const CACHE = 'taimako-v\d+';/,"const CACHE = 'taimako-v50';");
fs.writeFileSync(p,s);
console.log('TAIMAKO Stage 51 cache bumped to v50.');

require('./stage52-patch.js');

require('./stage54-patch.js');

require('./stage55-patch.js');

require('./stage56-patch.js');

require('./stage57-patch.js');

require('./stage58-patch.js');

require('./stage59-patch.js');

require('./stage60-patch.js');

require('./stage61-patch.js');

require('./stage62-patch.js');

require('./stage63-patch.js');

require('./stage64-patch.js');

require('./stage65-patch.js');

require('./stage66-patch.js');

require('./stage67-patch.js');

require('./stage68-patch.js');

require('./stage69-patch.js');

require('./stage70-patch.js');

require('./stage71-patch.js');

require('./stage72-patch.js');

require('./stage73-patch.js');

require('./stage74-patch.js');

require('./stage75-patch.js');

require('./stage76-patch.js');

require('./stage77-patch.js');

require('./stage78-patch.js');

require('./stage79-patch.js');

require('./stage80-patch.js');

require('./stage81-patch.js');

require('./stage82-patch.js');

require('./stage83-patch.js');


require('./stage85-patch.js');

require('./stage86-patch.js');

require('./stage87-patch.js');

require('./stage88-patch.js');

require('./stage89-patch.js');

require('./stage90-patch.js');

require('./stage93-patch.js');
require('./stage94-patch.js');
require('./stage95-patch.js');
require('./stage96-patch.js');
require('./stage97-patch.js');
require('./stage98-patch.js');
require('./stage99-patch.js');
require('./stage100-patch.js');
require('./stage101-patch.js');
require('./stage102-patch.js');
require('./stage103-patch.js');
require('./stage104-patch.js');
require('./stage105-patch.js');
require('./stage106-patch.js');
require('./stage107-patch.js');
require('./stage108-patch.js');
require('./stage109-patch.js');
require('./stage110-patch.js');
require('./stage111-patch.js');
require('./stage112-patch.js');
require('./stage113-patch.js');
require('./stage114-patch.js');
require('./stage115-patch.js');
require('./stage116-patch.js');
require('./stage117-patch.js');
require('./stage118-patch.js');
require('./stage119-patch.js');
require('./stage120-patch.js');
require('./stage122-diagnostic.js');
require('./stage123-patch.js');
require('./stage124-diagnostic.js');
require('./stage125-patch.js');
require('./stage126-diagnostic.js');
require('./stage127-diagnostic.js');
require('./stage128-diagnostic.js');
require('./stage129-patch.js');
require('./stage131-patch.js');
require('./stage132-patch.js');
require('./stage133-diagnostic.js');
require('./stage134-patch.js');
require('./stage135-diagnostic.js');
require('./stage136-patch.js');
require('./stage137-patch.js');
require('./stage138-diagnostic.js');
require('./stage139-diagnostic.js');
require('./stage140-diagnostic.js');
require('./stage141-patch.js');
require('./stage142-diagnostic.js');
require('./stage143-patch.js');
require('./stage144-patch.js');
require('./stage145-diagnostic.js');
require('./stage146-patch.js');
require('./stage147-diagnostic.js');
require('./stage148-patch.js');
require('./stage149-patch.js');
require('./stage150-diagnostic.js');
require('./stage151-patch.js');
require('./stage152-patch.js');
require('./stage153-diagnostic.js');
require('./stage154-patch.js');
require('./stage155-patch.js');
require('./stage156-patch.js');
require('./stage157-patch.js');
require('./stage158-patch.js');
require('./stage159-patch.js');
require('./stage160-diagnostic.js');
require('./stage161-patch.js');
require('./stage162-diagnostic.js');
require('./stage163-diagnostic.js');
require('./stage164-patch.js');
require('./stage165-diagnostic.js');
require('./stage166-patch.js');
require('./stage167-patch.js');
require('./stage168-diagnostic.js');
require('./stage169-patch.js');
require('./stage170-patch.js');
require('./stage171-patch.js');
require('./stage172-diagnostic.js');
require('./stage173-patch.js');
require('./stage174-patch.js');
require('./stage175-patch.js');
require('./stage176-diagnostic.js');
require('./stage177-patch.js');
require('./stage178-diagnostic.js');
require('./stage179-patch.js');
require('./stage180-patch.js');
require('./stage181-patch.js');
require('./stage182-patch.js');
require('./stage183-patch.js');
require('./stage184-patch.js');
require('./stage187-patch.js');
require('./stage188-diagnostic.js');
