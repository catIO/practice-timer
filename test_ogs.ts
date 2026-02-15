import ogs from 'open-graph-scraper';

const url = 'https://www.youtube.com/watch?v=mndUGmf7-Kw';

async function test() {
    try {
        const { result } = await ogs({ url });
        console.log('Success:', result.ogTitle);
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
