#include <iostream>
#include <fstream>
#include <cstdint>
#include <chrono>

using namespace std;


const uint32_t PAGE_SIZE = 8 * 1024;

int64_t DateNow ()
{

    return chrono::duration_cast<chrono::milliseconds>(
        chrono::system_clock::now().time_since_epoch()
    ).count();

}

void open_file( const string& file_name, fstream& db_file )
{

    db_file.open( file_name, ios::in | ios::out | ios::binary );
            
    // If file doesn't exist, create it
    if (!db_file.is_open()) {
        db_file.open( file_name, ios::out | ios::binary );
        db_file.close();
        db_file.open( file_name, ios::in | ios::out | ios::binary );
    }

}

struct Page 
{
    string file_path = "";
    uint32_t page_id = 1000000;
    bool is_dirty = false;
    char data[PAGE_SIZE] = {0};
};

class DiskManager
{

    private:
        unordered_map<string, fstream> open_files;

    public:
        DiskManager () {}

        void OpenTableFile ( const string& file_path )
        {
            if ( open_files.find( file_path ) == open_files.end() )
            {
                open_files[file_path].open( file_path, ios::in | ios::out | ios::binary );
            }
        }

        void ReadPage ( const string& file_path, uint32_t page_id, char* page_data )
        {
            OpenTableFile(file_path);

            auto& db_file = open_files[file_path];
            db_file.clear();
            db_file.seekg( page_id * PAGE_SIZE );
            db_file.read( page_data, PAGE_SIZE );
        }

        void WritePage ( const string& file_path, uint32_t page_id, const char* page_data )
        {
            OpenTableFile(file_path);

            auto& db_file = open_files[file_path];
            db_file.clear();
            db_file.seekp( page_id * PAGE_SIZE );
            db_file.write( page_data, PAGE_SIZE );
            db_file.flush();
        }

        void Close ()
        {
            // db_file.close();
        }

};

class BufferPoolManager {
    const static uint NUM_POOLS = 10;

    private:
        DiskManager disk_manager;
        Page pool[BufferPoolManager::NUM_POOLS];
        bool page_used[BufferPoolManager::NUM_POOLS] = {false};
        int64_t lru_time[BufferPoolManager::NUM_POOLS] = {0};

    public:
        BufferPoolManager () {}

        char* FetchPage ( const string& file_path, uint32_t page_id ) 
        {

            // Find PageID in buffer pool
            for ( uint i = 0; i < BufferPoolManager::NUM_POOLS; i ++ ) 
            {
                Page& page = pool[i];

                if ( page.page_id == page_id && page.file_path == file_path && page_used[i] ) 
                {
                    lru_time[i] = DateNow();
                    // cout << "Current Page Found in Buffer! Page: " << page_id << endl;
                    return page.data;
                }
            }

            // If we can't load the new page, load a new page.
            // - Find open page slot
            for ( uint i = 0; i < BufferPoolManager::NUM_POOLS; i ++ )
            {
                if ( !page_used[i] )
                {
                    // Found Page
                    Page& page = pool[i];

                    // cout << "Found Open Slot: " << page_id << endl;

                    // Load new Page
                    disk_manager.ReadPage( file_path, page_id, page.data );

                    page.page_id = page_id;
                    page.file_path = file_path;
                    page_used[i] = true;
                    lru_time[i] = DateNow();

                    return page.data;
                }
            }

            // - Load using LRU
            {
                // Find Oldest Update
                int64_t oldest_fetch = 0;
                uint32_t oldest_index = 0; 

                for ( uint32_t i = 0; i < BufferPoolManager::NUM_POOLS; i ++ )
                {
                    if ( lru_time[i] < oldest_fetch )
                    {
                        oldest_fetch = lru_time[i];
                        oldest_index = i;
                    }
                }

                // Load into Oldest
                Page& page = pool[oldest_index];
    
                if ( page.is_dirty ) 
                {
                    disk_manager.WritePage( file_path, page.page_id, page.data );
                    page.is_dirty = false;
                }
    
                disk_manager.ReadPage( file_path, page_id, page.data );
                
                page.page_id = page_id;
                page.file_path = file_path;
    
                return page.data;
            }
            
            return nullptr;

        }

        void SetPageDirty ( const string& file_path, uint32_t page_id )
        {

            for ( uint i = 0; i < BufferPoolManager::NUM_POOLS; i ++ )
            {
                Page& page = pool[i];

                if ( page.page_id == page_id && page.file_path == file_path )
                {
                    page.is_dirty = true;
                    break;
                }
            }

        }

        void FlushDirtyPages ()
        {
            
            for ( uint i = 0; i < BufferPoolManager::NUM_POOLS; i ++ )
            {
                Page& page = pool[i];

                if ( page.is_dirty )
                {
                    // Write to HD
                    disk_manager.WritePage( page.file_path, page.page_id, page.data );
                    page.is_dirty = false;
                }
            }

        }

        void AddPage ( const string& file_path, uint32_t page_id )
        {

            char data[PAGE_SIZE] = {0};

            disk_manager.WritePage( file_path, page_id, data );

        }

        void Close ()
        {

            FlushDirtyPages();

        }

};

